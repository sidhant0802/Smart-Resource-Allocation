const Report = require('../models/Report')

// ── Staff: Get their own reports ─────────────────────────────
exports.getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({
      submittedBy: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'fullName email')
      .populate('zone', 'name')

    res.json({ success: true, count: reports.length, reports })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
}

// ── Staff: Change visibility (draft → sent or sent → draft) ──
exports.updateVisibility = async (req, res) => {
  try {
    const { reportId }  = req.params
    const { visibility } = req.body

    if (!['draft', 'sent'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility' })
    }

    const report = await Report.findOne({
      _id:         reportId,
      submittedBy: req.user._id,
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (report.status === 'processing') {
      return res.status(400).json({
        error: 'Wait for AI analysis to complete before sending',
      })
    }

    report.visibility = visibility
    await report.save()

    res.json({
      success:    true,
      message:    visibility === 'sent'
        ? '✅ Report sent to Committee'
        : '📝 Report saved as draft',
      visibility: report.visibility,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update visibility' })
  }
}

// ── Committee: Get zone reports (only sent ones) ─────────────
exports.getZoneReports = async (req, res) => {
  try {
    const { status, severity, category } = req.query

    const filter = {
      zone:       req.user.zone,
      visibility: 'sent',
      // Committee only sees reports staff explicitly sent
    }

    if (status)   filter.status                    = status
    if (severity) filter['analysis.severityLevel'] = severity
    if (category) filter['analysis.category']      = category

    const reports = await Report.find(filter)
      .sort({ 'analysis.urgencyScore': -1, createdAt: -1 })
      .populate('submittedBy', 'fullName email phone')
      .populate('zone', 'name')

    res.json({ success: true, count: reports.length, reports })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
}

// ── Committee: Review report ─────────────────────────────────
exports.reviewReport = async (req, res) => {
  try {
    const { reportId }               = req.params
    const { status, reviewNotes }    = req.body

    const validStatuses = ['reviewed', 'resolved', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const report = await Report.findOne({
      _id:        reportId,
      zone:       req.user.zone,
      visibility: 'sent',
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    report.status      = status
    report.reviewedBy  = req.user._id
    report.reviewedAt  = new Date()
    report.reviewNotes = reviewNotes || ''
    await report.save()

    res.json({ success: true, message: `Report ${status}`, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to review' })
  }
}

// ── Committee: Zone stats ────────────────────────────────────
exports.getZoneStats = async (req, res) => {
  try {
    const zoneId = req.user.zone

    const [total, critical, high, pending, resolved] = await Promise.all([
      Report.countDocuments({ zone: zoneId, visibility: 'sent' }),
      Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'critical' }),
      Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'high' }),
      Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'analyzed' }),
      Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'resolved' }),
    ])

    res.json({ success: true, stats: { total, critical, high, pending, resolved } })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' })
  }
}

// ── Get single report ────────────────────────────────────────
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId)
      .populate('submittedBy', 'fullName email phone locationName')
      .populate('zone',        'name city state')
      .populate('ngo',         'name')
      .populate('reviewedBy',  'fullName')

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' })
  }
}