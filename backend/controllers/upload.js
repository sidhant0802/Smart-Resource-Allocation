const path           = require('path')
const fs             = require('fs')
const multer         = require('multer')
const { v4: uuidv4 } = require('uuid')
const axios          = require('axios')
const FormData       = require('form-data')
const Report         = require('../models/Report')
const NGO            = require('../models/NGO')
const Zone           = require('../models/Zone')
const StaffApplication = require('../models/StaffApplication')

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:8000'

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
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('File type not supported'), false)
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } })

exports.uploadMiddleware = upload.single('file')

// ═══════════════════════════════════════════════════════════
// Upload and process report
// ═══════════════════════════════════════════════════════════
exports.uploadAndProcess = async (req, res) => {
  try {
    const {
      title, description, voiceText,
      locationName, latitude, longitude, visibility,
      ngoId, zoneId,
    } = req.body

    const file = req.file
    let fileType = 'text'
    let filePath = null
    let fileUrl  = null

    if (file) {
      if (file.mimetype.includes('pdf'))   fileType = 'pdf'
      if (file.mimetype.includes('image')) fileType = 'image'
      if (file.mimetype.includes('audio')) fileType = 'voice'
      filePath = file.path
      fileUrl  = `/${file.path}`
    }

    let reportNgo  = ngoId || req.user.ngo
    let reportZone = zoneId || req.user.zone

    // ✅ Check if user can submit to this NGO
    if (ngoId && ngoId !== req.user.ngo?.toString()) {
      // Get full user with approvedNgos
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

    const report = await Report.create({
      submittedBy: req.user._id,
      ngo: reportNgo,
      zone: reportZone,
      title: title || 'Untitled Report',
      fileType, fileUrl,
      fileName: file?.originalname,
      fileSize: file?.size,
      manualDescription: description || voiceText || '',
      locationName: locationName || req.user.locationName,
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      visibility: visibility || 'draft',
      status: 'processing',
    })

    processWithPython(report._id.toString(), fileType, filePath, description || voiceText || '')

    res.status(201).json({
      success: true,
      message: 'Report submitted. AI analyzing...',
      reportId: report._id,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message })
  }
}
// ═══════════════════════════════════════════════════════════
// Get nearby NGOs
// ═══════════════════════════════════════════════════════════
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
    }

    // Check which NGOs this staff has applied to
    const applications = await StaffApplication.find({ userId: req.user._id })
      .select('ngoId status')

    const applicationMap = {}
    applications.forEach(app => {
      applicationMap[app.ngoId.toString()] = app.status
    })

    ngos = ngos.map(ngo => ({
      ...ngo,
      applicationStatus: applicationMap[ngo._id.toString()] || null,
      isMyNgo: req.user.ngo?.toString() === ngo._id.toString()
    }))

    res.json({ success: true, count: ngos.length, ngos })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to fetch NGOs' })
  }
}

// ═══════════════════════════════════════════════════════════
// Apply to NGO as staff
// ═══════════════════════════════════════════════════════════
exports.applyToNgo = async (req, res) => {
  try {
    const { ngoId, message } = req.body
    const userId = req.user._id

    if (!ngoId) return res.status(400).json({ error: 'NGO ID required' })

    // Check NGO exists and is approved
    const ngo = await NGO.findById(ngoId)
    if (!ngo) return res.status(404).json({ error: 'NGO not found' })
    if (ngo.status !== 'approved') return res.status(400).json({ error: 'NGO not approved' })

    // Check if already applied
    const existing = await StaffApplication.findOne({ userId, ngoId })
    if (existing) {
      return res.status(400).json({
        error: `Already ${existing.status} for this NGO`
      })
    }

    const application = await StaffApplication.create({
      userId,
      ngoId,
      message: message || '',
      status: 'pending'
    })

    console.log(`📋 Staff ${userId} applied to NGO ${ngo.name}`)

    res.status(201).json({
      success: true,
      message: `Application submitted to ${ngo.name}!`,
      data: application
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to apply' })
  }
}

// ═══════════════════════════════════════════════════════════
// Get my NGO applications
// ═══════════════════════════════════════════════════════════
exports.getMyNgoApplications = async (req, res) => {
  try {
    const applications = await StaffApplication.find({ userId: req.user._id })
      .populate('ngoId', 'name description locationName')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: applications.map(app => ({
        _id: app._id,
        ngo: app.ngoId,
        status: app.status,
        message: app.message,
        reviewNote: app.reviewNote,
        appliedAt: app.createdAt,
        reviewedAt: app.reviewedAt
      }))
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
}

// ═══════════════════════════════════════════════════════════
// Get NGO zones
// ═══════════════════════════════════════════════════════════
exports.getNgoZones = async (req, res) => {
  try {
    const { ngoId } = req.params
    const zones = await Zone.find({ ngo: ngoId, status: 'active' })
      .select('name description locationName city state')

    res.json({ success: true, count: zones.length, zones })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to fetch zones' })
  }
}
exports.getStaffProfile = async (req, res) => {
  try {
    const User = require('../models/User')
    const user = await User.findById(req.user._id)
      .populate('ngo', 'name status')
      .populate('zone', 'name city state')
      .populate('approvedNgos.ngoId', 'name locationName')
      .select('fullName email phone location locationName roleName status approvedNgos')

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

    // Get approved NGOs from both StaffApplication AND user.approvedNgos
    const approvedFromUser = (user.approvedNgos || []).map(a => ({
      _id: a.ngoId?._id,
      name: a.ngoId?.name || 'Unknown',
      locationName: a.ngoId?.locationName
    }))

    res.json({
      success: true,
      user: {
        id: user._id, fullName: user.fullName, email: user.email,
        phone: user.phone, role: user.roleName, status: user.status,
        location: user.location, locationName: user.locationName,
        ngo: user.ngo, zone: user.zone,
      },
      stats: {
        totalReports, sentReports, draftReports,
        severity: { critical, high, medium, low }
      },
      approvedNgos: approvedFromUser
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}
// ═══════════════════════════════════════════════════════════
// Report status
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// Python ML processing
// ═══════════════════════════════════════════════════════════
const processWithPython = async (reportId, fileType, filePath, rawText) => {
  try {
    console.log(`\n🐍 Python ML processing report: ${reportId}`)
    const formData = new FormData()
    formData.append('file_type', fileType)
    formData.append('raw_text', rawText || '')
    formData.append('report_id', reportId)
    formData.append('extra_context', rawText || '')

    if (filePath && fs.existsSync(filePath)) {
      formData.append('file', fs.createReadStream(filePath))
    }

    const response = await axios.post(`${PYTHON_ML_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    })

    const result = response.data
    console.log(`✅ Python ML done. Score: ${result.urgency_score} (${result.severity_level})`)

    await Report.findByIdAndUpdate(reportId, {
      originalText: result.original_text || rawText,
      status: 'analyzed',
      analysis: {
        urgencyScore: result.urgency_score, severityLevel: result.severity_level,
        category: result.category, sentiment: result.sentiment,
        summary: result.summary, detailedAnalysis: result.detailed_analysis,
        keyProblems: result.key_problems || [], suggestedActions: result.suggested_actions || [],
        keywords: result.keywords || [], affectedPeople: result.affected_people,
        affectedArea: result.affected_area, immediateRisk: result.immediate_risk,
        confidenceScore: result.confidence_score, processingTime: result.processing_time,
        model: result.model_used,
      },
    })
  } catch (error) {
    console.error(`❌ Python ML failed:`, error.message)
    await Report.findByIdAndUpdate(reportId, {
      status: 'analyzed',
      analysis: {
        urgencyScore: 0, severityLevel: 'info',
        summary: 'Analysis service unavailable. Review manually.',
        keyProblems: [], suggestedActions: ['Review manually'],
        keywords: [], immediateRisk: false, model: 'error',
      },
    })
  }
}

function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2) return 0
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return parseFloat((R * c).toFixed(1))
}