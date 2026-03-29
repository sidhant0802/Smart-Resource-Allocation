const path           = require('path')
const fs             = require('fs')
const multer         = require('multer')
const { v4: uuidv4 } = require('uuid')
const axios          = require('axios')
const FormData       = require('form-data')
const Report         = require('../models/Report')

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:8000'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.mimetype
    let folder = 'uploads/others'
    if (type.includes('pdf'))   folder = 'uploads/pdfs'
    if (type.includes('image')) folder = 'uploads/images'
    if (type.includes('audio')) folder = 'uploads/audio'

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
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

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
})

exports.uploadMiddleware = upload.single('file')

exports.uploadAndProcess = async (req, res) => {
  try {
    const {
      title, description, voiceText,
      locationName, latitude, longitude, visibility,
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

    // Create initial report
    const report = await Report.create({
      submittedBy:       req.user._id,
      ngo:               req.user.ngo,
      zone:              req.user.zone,
      title:             title || 'Untitled Report',
      fileType,
      fileUrl,
      fileName:          file?.originalname,
      fileSize:          file?.size,
      manualDescription: description || voiceText || '',
      locationName:      locationName || req.user.locationName,
      latitude:          parseFloat(latitude)  || null,
      longitude:         parseFloat(longitude) || null,
      visibility:        visibility || 'draft',
      status:            'processing',
    })

    // Process in background
    processWithPython(
      report._id.toString(),
      fileType,
      filePath,
      description || voiceText || '',
    )

    res.status(201).json({
      success:  true,
      message:  'Report submitted. Python ML + Gemini AI analyzing...',
      reportId: report._id,
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message })
  }
}

const processWithPython = async (reportId, fileType, filePath, rawText) => {
  try {
    console.log(`\n🐍 Python ML processing report: ${reportId}`)

    const formData = new FormData()
    formData.append('file_type', fileType)
    formData.append('raw_text',  rawText || '')
    formData.append('report_id', reportId)
    formData.append('extra_context', rawText || '')

    // Attach file if exists
    if (filePath && fs.existsSync(filePath)) {
      formData.append('file', fs.createReadStream(filePath))
    }

    const response = await axios.post(
      `${PYTHON_ML_URL}/analyze`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000,
        // 60s timeout for ML processing
      }
    )

    const result = response.data
    console.log(`✅ Python ML done. Score: ${result.urgency_score} (${result.severity_level})`)

    // Update report with results
    await Report.findByIdAndUpdate(reportId, {
      originalText: result.original_text || rawText,
      status:       'analyzed',
      analysis: {
        urgencyScore:      result.urgency_score,
        severityLevel:     result.severity_level,
        category:          result.category,
        sentiment:         result.sentiment,
        sentimentScore:    result.sentiment_score,
        summary:           result.summary,
        detailedAnalysis:  result.detailed_analysis,
        keyProblems:       result.key_problems       || [],
        suggestedActions:  result.suggested_actions  || [],
        keywords:          result.keywords           || [],
        affectedPeople:    result.affected_people,
        affectedArea:      result.affected_area,
        immediateRisk:     result.immediate_risk,
        confidenceScore:   result.confidence_score,
        explanation:       result.explanation,
        processingTime:    result.processing_time,
        model:             result.model_used,
      },
    })

    console.log(`📊 Report ${reportId} updated in DB`)

  } catch (error) {
    console.error(`❌ Python ML failed:`, error.message)

    // Mark as analyzed with error
    await Report.findByIdAndUpdate(reportId, {
      status: 'analyzed',
      analysis: {
        urgencyScore:    0,
        severityLevel:   'info',
        summary:         'Analysis service unavailable. Please review manually.',
        keyProblems:     [],
        suggestedActions: ['Review report content manually'],
        keywords:        [],
        immediateRisk:   false,
        model:           'error',
      },
    })
  }
}

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