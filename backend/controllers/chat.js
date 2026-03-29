const axios       = require('axios')
const Report      = require('../models/Report')
const ChatMessage = require('../models/ChatMessage')

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:8000'

exports.sendMessage = async (req, res) => {
  try {
    const { reportId, message } = req.body
    const userId = req.user._id

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Get report
    const report = await Report.findOne({
      _id:         reportId,
      submittedBy: userId,
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (report.status === 'processing') {
      return res.json({
        message:        '⏳ Report is still being analyzed. Please wait...',
        recommendation: 'neutral',
        confidence:     0,
      })
    }

    // Get chat history
    const history = await ChatMessage.find({
      reportId,
      userId,
    })
      .sort({ createdAt: 1 })
      .limit(10)
      .select('role content')

    // Save user message
    await ChatMessage.create({
      reportId,
      userId,
      role:    'user',
      content: message,
    })

    // Build report data for Python
    const reportData = {
      title:      report.title,
      fileType:   report.fileType,
      visibility: report.visibility,
      analysis: {
        urgencyScore:     report.analysis?.urgencyScore,
        severityLevel:    report.analysis?.severityLevel,
        category:         report.analysis?.category,
        summary:          report.analysis?.summary,
        keyProblems:      report.analysis?.keyProblems,
        suggestedActions: report.analysis?.suggestedActions,
        immediateRisk:    report.analysis?.immediateRisk,
        confidenceScore:  report.analysis?.confidenceScore,
      },
    }

    // Call Python chat service
    const pythonResponse = await axios.post(
      `${PYTHON_ML_URL}/chat`,
      {
        report_id:   reportId,
        message,
        report_data: reportData,
        history:     history.map(h => ({
          role:    h.role,
          content: h.content,
        })),
      },
      { timeout: 30000 }
    )

    const aiResult = pythonResponse.data

    // Save AI response
    await ChatMessage.create({
      reportId,
      userId,
      role:           'assistant',
      content:        aiResult.message,
      recommendation: aiResult.recommendation,
      confidence:     aiResult.confidence,
    })

    res.json({
      success:        true,
      message:        aiResult.message,
      recommendation: aiResult.recommendation,
      confidence:     aiResult.confidence,
    })

  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({
      message:        'AI assistant is temporarily unavailable. Please review the urgency score manually.',
      recommendation: 'neutral',
      confidence:     0.5,
    })
  }
}

exports.getChatHistory = async (req, res) => {
  try {
    const { reportId } = req.params
    const userId       = req.user._id

    const messages = await ChatMessage.find({ reportId, userId })
      .sort({ createdAt: 1 })
      .select('role content recommendation confidence createdAt')

    res.json({ success: true, messages })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat history' })
  }
}