const path     = require('path')
const fs       = require('fs')
const multer   = require('multer')
const { v4: uuidv4 } = require('uuid')
const axios    = require('axios')
const FormData = require('form-data')
const Report   = require('../models/Report')
const NGO      = require('../models/NGO')
const Zone     = require('../models/Zone')
const StaffApplication = require('../models/StaffApplication')

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:8000'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// ══════════════════════════════════════════════════════════════
// STORAGE SETUP — Auto-detect Local vs Production
// ══════════════════════════════════════════════════════════════

let uploadMiddlewareHandler

const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (hasCloudinary) {
  // ── Production: Cloudinary ─────────────────────────────────
  const { upload } = require('../config/cloudinary')
  uploadMiddlewareHandler = upload.single('file')
  console.log('📁 Storage: Cloudinary ✅')
} else {
  // ── Local Development: Disk ────────────────────────────────
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const type = file.mimetype
      let folder = 'uploads/others'
      if (type.includes('pdf'))   folder = 'uploads/pdfs'
      if (type.includes('image')) folder = 'uploads/images'
      if (type.includes('audio')) folder = 'uploads/audio'
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
      cb(null, folder)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `${uuidv4()}${ext}`)
    },
  })

  const fileFilter = (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
    ]
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('File type not supported'), false)
  }

  uploadMiddlewareHandler = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 },
  }).single('file')

  console.log('📁 Storage: Local disk')
}

exports.uploadMiddleware = uploadMiddlewareHandler

// ══════════════════════════════════════════════════════════════
// Upload and process report
// ══════════════════════════════════════════════════════════════
exports.uploadAndProcess = async (req, res) => {
  try {
    const {
      title, description, voiceText,
      locationName, latitude, longitude,
      visibility, ngoId, zoneId,
    } = req.body

    const file = req.file

    let fileType = 'text'
    let filePath = null   // Local disk path
    let fileUrl  = null   // URL (local or Cloudinary)
    let fileName = null
    let fileSize = null

    if (file) {
      // Detect file type from mimetype
      if (file.mimetype.includes('pdf'))   fileType = 'pdf'
      if (file.mimetype.includes('image')) fileType = 'image'
      if (file.mimetype.includes('audio')) fileType = 'voice'

      if (hasCloudinary) {
        // Cloudinary: file.path = full HTTPS URL
        fileUrl  = file.path
        filePath = null
      } else {
        // Local disk: file.path = local filesystem path
        filePath = file.path
        fileUrl  = `/${file.path}`
      }

      fileName = file.originalname
      fileSize = file.size

      console.log(`📁 File: ${fileType} | ${fileName} | ${fileSize} bytes`)
      if (hasCloudinary) console.log(`🌐 Cloudinary URL: ${fileUrl}`)
    }

    let reportNgo  = ngoId || req.user.ngo
    let reportZone = zoneId || req.user.zone

    // Check NGO submission permission
    if (ngoId && ngoId !== req.user.ngo?.toString()) {
      const fullUser = await require('../models/User').findById(req.user._id)
      if (!fullUser.canSubmitToNgo(ngoId)) {
        return res.status(403).json({
          error: 'You need approved application to submit reports to this NGO. Apply from "My NGOs" tab.'
        })
      }
    }

    // Validate NGO
    if (reportNgo) {
      const ngo = await NGO.findById(reportNgo)
      if (!ngo) return res.status(400).json({ error: 'NGO not found' })
      if (ngo.status !== 'approved') return res.status(400).json({ error: 'NGO not approved' })
    }

    // Create report in MongoDB
    const report = await Report.create({
      submittedBy:       req.user._id,
      ngo:               reportNgo,
      zone:              reportZone,
      title:             title || 'Untitled Report',
      fileType,
      fileUrl,
      fileName,
      fileSize,
      manualDescription: description || voiceText || '',
      locationName:      locationName || req.user.locationName,
      latitude:          parseFloat(latitude) || null,
      longitude:         parseFloat(longitude) || null,
      visibility:        visibility || 'draft',
      status:            'processing',
    })

    console.log(`✅ Report created: ${report._id}`)

    // Process with ML — async (don't block response)
    processWithPython(
      report._id.toString(),
      fileType,
      hasCloudinary ? fileUrl : filePath,
      description || voiceText || ''
    )

    res.status(201).json({
      success:  true,
      message:  'Report submitted. AI analyzing...',
      reportId: report._id,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message })
  }
}

// ══════════════════════════════════════════════════════════════
// Python ML processing (supports both local and Cloudinary)
// ══════════════════════════════════════════════════════════════
const processWithPython = async (reportId, fileType, filePathOrUrl, rawText) => {
  try {
    console.log(`\n🐍 ML processing: ${reportId} | type=${fileType}`)

    const formData = new FormData()
    formData.append('file_type',     fileType)
    formData.append('raw_text',      rawText || '')
    formData.append('report_id',     reportId)
    formData.append('extra_context', rawText || '')

    // Attach file to ML request
    if (filePathOrUrl && fileType !== 'text' && fileType !== 'voice') {

      if (filePathOrUrl.startsWith('http')) {
        // ── Cloudinary URL: Download then send ──────────────
        try {
          console.log(`📥 Downloading from Cloudinary...`)
          const fileRes = await axios.get(filePathOrUrl, {
            responseType: 'arraybuffer',
            timeout:      30000,
          })

          const mimeTypes = {
            pdf:   'application/pdf',
            image: 'image/jpeg',
            voice: 'audio/mpeg',
          }
          const extensions = {
            pdf:   'pdf',
            image: 'jpg',
            voice: 'mp3',
          }

          formData.append('file', Buffer.from(fileRes.data), {
            filename:    `report.${extensions[fileType] || 'bin'}`,
            contentType: mimeTypes[fileType] || 'application/octet-stream',
          })

          console.log(`✅ File downloaded (${fileRes.data.byteLength} bytes)`)
        } catch (downloadErr) {
          console.warn('⚠️ Cloudinary download failed:', downloadErr.message)
          // Continue without file — ML will analyze text only
        }

      } else if (filePathOrUrl && fs.existsSync(filePathOrUrl)) {
        // ── Local file: Read from disk ──────────────────────
        formData.append('file', fs.createReadStream(filePathOrUrl))
        console.log(`📁 Attaching local file: ${filePathOrUrl}`)
      }
    }

    const response = await axios.post(
      `${PYTHON_ML_URL}/analyze`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 90000, // 90 second timeout for ML
      }
    )

    const result = response.data
    console.log(`✅ ML done: Score=${result.urgency_score} Level=${result.severity_level}`)

    // Update report with analysis results
    await Report.findByIdAndUpdate(reportId, {
      originalText: result.original_text || rawText,
      status:       'analyzed',
      analysis: {
        urgencyScore:     result.urgency_score,
        severityLevel:    result.severity_level,
        category:         result.category,
        sentiment:        result.sentiment,
        summary:          result.summary,
        detailedAnalysis: result.detailed_analysis,
        keyProblems:      result.key_problems      || [],
        suggestedActions: result.suggested_actions || [],
        keywords:         result.keywords          || [],
        affectedPeople:   result.affected_people,
        affectedArea:     result.affected_area,
        immediateRisk:    result.immediate_risk,
        confidenceScore:  result.confidence_score,
        processingTime:   result.processing_time,
        model:            result.model_used,
      },
    })

    console.log(`✅ Report ${reportId} analysis saved to MongoDB`)

  } catch (error) {
    console.error(`❌ ML processing failed for ${reportId}:`, error.message)

    // Save error state so frontend can show something
    await Report.findByIdAndUpdate(reportId, {
      status:   'analyzed',
      analysis: {
        urgencyScore:     0,
        severityLevel:    'info',
        summary:          'AI analysis service unavailable. Please review this report manually.',
        detailedAnalysis: 'The analysis service could not process this report. Manual review required.',
        keyProblems:      ['Automatic analysis failed'],
        suggestedActions: ['Review report manually', 'Re-submit if issue persists'],
        keywords:         [],
        immediateRisk:    false,
        model:            'error',
      },
    })
  }
}

// ══════════════════════════════════════════════════════════════
// Get nearby NGOs
// ══════════════════════════════════════════════════════════════
exports.getNearbyNgos = async (req, res) => {
  try {
    const { latitude, longitude } = req.query

    let ngos = await NGO.find({ status: 'approved' })
      .select('name description location locationName contactEmail')

    if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)

      ngos = ngos.map(ngo => {
        const ngoObj = ngo.toObject()
        if (ngo.location?.coordinates) {
          ngoObj.distance = calculateDistance([lng, lat], ngo.location.coordinates)
        } else {
          ngoObj.distance = null
        }
        return ngoObj
      })

      ngos.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    } else {
      ngos = ngos.map(n => n.toObject())
    }

    // Get application status for current user
    const staffApps = await StaffApplication.find({ userId: req.user._id })
      .select('ngoId status')

    const User = require('../models/User')
    const user = await User.findById(req.user._id).select('approvedNgos ngo')

    const staffAppMap = {}
    staffApps.forEach(app => {
      staffAppMap[app.ngoId.toString()] = app.status
    })

    const userApprovedSet = new Set(
      (user.approvedNgos || [])
        .map(a => (a.ngoId?._id || a.ngoId)?.toString())
        .filter(Boolean)
    )

    ngos = ngos.map(ngo => {
      const ngoIdStr = ngo._id.toString()
      let applicationStatus = staffAppMap[ngoIdStr] || null

      // If in user.approvedNgos → definitely approved
      if (userApprovedSet.has(ngoIdStr)) applicationStatus = 'approved'

      return {
        ...ngo,
        applicationStatus,
        isMyNgo: user.ngo?.toString() === ngoIdStr,
      }
    })

    res.json({ success: true, count: ngos.length, ngos })
  } catch (error) {
    console.error('getNearbyNgos error:', error)
    res.status(500).json({ error: 'Failed to fetch NGOs' })
  }
}

// ══════════════════════════════════════════════════════════════
// Apply to NGO as staff
// ══════════════════════════════════════════════════════════════
exports.applyToNgo = async (req, res) => {
  try {
    const { ngoId, message } = req.body
    const userId = req.user._id

    if (!ngoId) return res.status(400).json({ error: 'NGO ID required' })

    const ngo = await NGO.findById(ngoId)
    if (!ngo) return res.status(404).json({ error: 'NGO not found' })
    if (ngo.status !== 'approved') return res.status(400).json({ error: 'NGO not approved' })

    // Check duplicate application
    const existing = await StaffApplication.findOne({ userId, ngoId })
    if (existing) {
      return res.status(400).json({
        error: `Already ${existing.status} for this NGO`,
        status: existing.status,
      })
    }

    const application = await StaffApplication.create({
      userId,
      ngoId,
      message: message || '',
      status:  'pending',
    })

    console.log(`📋 Staff ${userId} applied to NGO ${ngo.name}`)

    res.status(201).json({
      success: true,
      message: `Application submitted to ${ngo.name}!`,
      data:    application,
    })
  } catch (error) {
    console.error('applyToNgo error:', error)
    res.status(500).json({ error: 'Failed to apply' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get my NGO applications
// ══════════════════════════════════════════════════════════════
exports.getMyNgoApplications = async (req, res) => {
  try {
    const applications = await StaffApplication.find({ userId: req.user._id })
      .populate('ngoId', 'name description locationName status contactEmail')
      .sort({ createdAt: -1 })

    const User = require('../models/User')
    const user = await User.findById(req.user._id)
      .populate('approvedNgos.ngoId', 'name locationName')
      .select('approvedNgos ngo')

    // Build set of approved NGO IDs from user.approvedNgos
    const approvedNgoIds = new Set(
      (user.approvedNgos || [])
        .map(a => (a.ngoId?._id || a.ngoId)?.toString())
        .filter(Boolean)
    )

    const result = applications.map(app => {
      const ngoId       = (app.ngoId?._id || app.ngoId)?.toString()
      const finalStatus = approvedNgoIds.has(ngoId) ? 'approved' : app.status

      return {
        _id:        app._id,
        ngo:        app.ngoId,
        status:     finalStatus,
        message:    app.message,
        reviewNote: app.reviewNote,
        appliedAt:  app.createdAt,
        reviewedAt: app.reviewedAt,
      }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('getMyNgoApplications error:', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get NGO zones
// ══════════════════════════════════════════════════════════════
exports.getNgoZones = async (req, res) => {
  try {
    const { ngoId } = req.params
    const zones = await Zone.find({ ngo: ngoId })
      .select('name description locationName city state')

    res.json({ success: true, count: zones.length, zones })
  } catch (error) {
    console.error('getNgoZones error:', error)
    res.status(500).json({ error: 'Failed to fetch zones' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get staff profile
// ══════════════════════════════════════════════════════════════
exports.getStaffProfile = async (req, res) => {
  try {
    const User = require('../models/User')

    const user = await User.findById(req.user._id)
      .populate('ngo',  'name status locationName contactEmail')
      .populate('zone', 'name city state')
      .populate('approvedNgos.ngoId', 'name locationName status')
      .select('fullName email phone location locationName roleName status approvedNgos ngo zone staffProfile createdAt')

    const [totalReports, sentReports, draftReports] = await Promise.all([
      Report.countDocuments({ submittedBy: req.user._id }),
      Report.countDocuments({ submittedBy: req.user._id, visibility: 'sent' }),
      Report.countDocuments({ submittedBy: req.user._id, visibility: 'draft' }),
    ])

    const [critical, high, medium, low] = await Promise.all([
      Report.countDocuments({ submittedBy: req.user._id, 'analysis.severityLevel': 'critical' }),
      Report.countDocuments({ submittedBy: req.user._id, 'analysis.severityLevel': 'high' }),
      Report.countDocuments({ submittedBy: req.user._id, 'analysis.severityLevel': 'medium' }),
      Report.countDocuments({ submittedBy: req.user._id, 'analysis.severityLevel': 'low' }),
    ])

    // Merge approved NGOs from both StaffApplication and user.approvedNgos
    const approvedApps = await StaffApplication.find({
      userId: req.user._id,
      status: 'approved',
    }).populate('ngoId', 'name locationName status')

    const approvedNgosMap = new Map()

    // Source 1: StaffApplication
    approvedApps.forEach(app => {
      if (app.ngoId) {
        approvedNgosMap.set(app.ngoId._id.toString(), {
          _id:          app.ngoId._id,
          name:         app.ngoId.name,
          locationName: app.ngoId.locationName,
          approvedAt:   app.reviewedAt || app.updatedAt,
          source:       'staff_application',
        })
      }
    })

    // Source 2: user.approvedNgos
    if (user.approvedNgos?.length > 0) {
      user.approvedNgos.forEach(a => {
        if (a.ngoId) {
          const id = a.ngoId._id?.toString() || a.ngoId.toString()
          if (!approvedNgosMap.has(id)) {
            approvedNgosMap.set(id, {
              _id:          a.ngoId._id || a.ngoId,
              name:         a.ngoId.name || 'Unknown',
              locationName: a.ngoId.locationName,
              approvedAt:   a.approvedAt,
              source:       'user_approved_ngos',
            })
          }
        }
      })
    }

    const approvedNgos = Array.from(approvedNgosMap.values())

    res.json({
      success: true,
      user: {
        id:           user._id,
        fullName:     user.fullName,
        email:        user.email,
        phone:        user.phone,
        role:         user.roleName,
        status:       user.status,
        location:     user.location,
        locationName: user.locationName,
        ngo:          user.ngo,
        zone:         user.zone,
        createdAt:    user.createdAt,
        staffProfile: user.staffProfile,
      },
      stats: {
        totalReports,
        sentReports,
        draftReports,
        severity: { critical, high, medium, low },
      },
      approvedNgos,
    })
  } catch (error) {
    console.error('getStaffProfile error:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get report status (polling endpoint)
// ══════════════════════════════════════════════════════════════
exports.getReportStatus = async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId)
      .select('status analysis title visibility')

    if (!report) return res.status(404).json({ error: 'Report not found' })

    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' })
  }
}

// ══════════════════════════════════════════════════════════════
// Helper: Calculate distance between two coordinates (km)
// ══════════════════════════════════════════════════════════════
function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2) return 0
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return parseFloat((R * c).toFixed(1))
}