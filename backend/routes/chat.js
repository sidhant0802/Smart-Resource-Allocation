const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth.middleware')

router.use(protect)

// ✅ Add /message route
router.post('/message', async (req, res) => {
  try {
    const { reportId, message, history } = req.body
    const axios = require('axios')

    const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:8000'

    // Get report data for context
    const Report = require('../models/Report')
    const report = await Report.findById(reportId).lean()

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    // Send to Python ML service
    const response = await axios.post(`${PYTHON_ML_URL}/chat`, {
      report_id:   reportId,
      message:     message,
      report_data: {
        title:        report.title,
        analysis:     report.analysis || {},
        originalText: report.originalText || report.manualDescription || '',
      },
      history: history || [],
    })

    res.json({
      success:        true,
      message:        response.data.message,
      recommendation: response.data.recommendation,
      confidence:     response.data.confidence,
    })

  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({
      error:   'Chat failed',
      message: error.message,
    })
  }
})

module.exports = router