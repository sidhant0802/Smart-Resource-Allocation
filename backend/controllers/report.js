const Report = require('../models/Report')
const User = require('../models/User')
const Task = require('../models/Task')
const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const Zone = require('../models/Zone')
const NGO = require('../models/NGO')

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

// ── Staff: Change visibility ──────────────────────────────────
exports.updateVisibility = async (req, res) => {
  try {
    const { reportId } = req.params
    const { visibility } = req.body

    if (!['draft', 'sent'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility' })
    }

    const report = await Report.findOne({
      _id: reportId,
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
      success: true,
      message:
        visibility === 'sent'
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
      zone: req.user.zone,
      visibility: 'sent',
    }

    if (status) filter.status = status
    if (severity) filter['analysis.severityLevel'] = severity
    if (category) filter['analysis.category'] = category

    const reports = await Report.find(filter)
      .sort({ 'analysis.urgencyScore': -1, createdAt: -1 })
      .populate('submittedBy', 'fullName email phone locationName')
      .populate('zone', 'name')
      .populate('ngo', 'name')

    res.json({ success: true, count: reports.length, reports })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
}

// ── Committee: Review report ─────────────────────────────────
exports.reviewReport = async (req, res) => {
  try {
    const { reportId } = req.params
    const { status, reviewNotes } = req.body

    const validStatuses = ['reviewed', 'resolved', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const report = await Report.findOne({
      _id: reportId,
      zone: req.user.zone,
      visibility: 'sent',
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    report.status = status
    report.reviewedBy = req.user._id
    report.reviewedAt = new Date()
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

    // Get user's NGO ID
    let ngoId = req.user.ngo?._id || req.user.ngo || null
    if (!ngoId && req.user.roleName === 'ngo_manager') {
      const managedNgo = await NGO.findOne({ managedBy: req.user._id })
      if (managedNgo) ngoId = managedNgo._id
    }

    const [total, critical, high, pending, resolved, reviewed, rejected] =
      await Promise.all([
        Report.countDocuments({ zone: zoneId, visibility: 'sent' }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          'analysis.severityLevel': 'critical',
        }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          'analysis.severityLevel': 'high',
        }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          status: 'analyzed',
        }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          status: 'resolved',
        }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          status: 'reviewed',
        }),
        Report.countDocuments({
          zone: zoneId,
          visibility: 'sent',
          status: 'rejected',
        }),
      ])

    const staffCount = await User.countDocuments({
      zone: zoneId,
      roleName: 'ngo_staff',
      status: 'active',
    })

    const volunteerAppCount = ngoId
      ? await VolunteerApplication.countDocuments({
          ngoId: ngoId,
          status: 'pending',
        })
      : 0

    const activeTasks = ngoId
      ? await Task.countDocuments({
          ngoId: ngoId,
          status: { $in: ['open', 'in-progress'] },
        })
      : 0

    const approvedVolunteers = ngoId
      ? await VolunteerApplication.countDocuments({
          ngoId: ngoId,
          status: 'approved',
        })
      : 0

    res.json({
      success: true,
      stats: {
        total,
        critical,
        high,
        pending,
        resolved,
        reviewed,
        rejected,
        staffCount,
        volunteerAppCount,
        activeTasks,
        approvedVolunteers,
      },
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
}

// ── Get single report ────────────────────────────────────────
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId)
      .populate('submittedBy', 'fullName email phone locationName')
      .populate('zone', 'name city state')
      .populate('ngo', 'name')
      .populate('reviewedBy', 'fullName')

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get zone staff members
// ══════════════════════════════════════════════════════════════
exports.getZoneStaff = async (req, res) => {
  try {
    // For committee_member use zone, for ngo_manager use ngo
    let filter = { roleName: 'ngo_staff' }

    if (req.user.roleName === 'committee_member' && req.user.zone) {
      filter.zone = req.user.zone
    } else if (req.user.roleName === 'ngo_manager') {
      let ngoId = req.user.ngo?._id || req.user.ngo
      if (!ngoId) {
        const managedNgo = await NGO.findOne({ managedBy: req.user._id })
        if (managedNgo) ngoId = managedNgo._id
      }
      if (ngoId) filter.ngo = ngoId
    }

    const staff = await User.find(filter)
      .select(
        'fullName email phone status location locationName createdAt staffProfile zone'
      )
      .populate('zone', 'name')
      .sort({ createdAt: -1 })

    const staffWithStats = await Promise.all(
      staff.map(async (s) => {
        const reportCount = await Report.countDocuments({ submittedBy: s._id })
        const sentCount = await Report.countDocuments({
          submittedBy: s._id,
          visibility: 'sent',
        })
        return {
          ...s.toObject(),
          reportCount,
          sentCount,
        }
      })
    )

    res.json({ success: true, staff: staffWithStats })
  } catch (error) {
    console.error('Get staff error:', error)
    res.status(500).json({ error: 'Failed to fetch staff' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get volunteer applications for zone/NGO
// ══════════════════════════════════════════════════════════════
exports.getZoneVolunteerApplications = async (req, res) => {
  try {
    const { status } = req.query

    // Get NGO ID for both roles
    let ngoId = null

    if (req.user.ngo?._id) {
      ngoId = req.user.ngo._id
    } else if (req.user.ngo) {
      ngoId = req.user.ngo
    }

    // If ngo_manager, also try finding NGO they manage
    if (!ngoId && req.user.roleName === 'ngo_manager') {
      const managedNgo = await NGO.findOne({ managedBy: req.user._id })
      if (managedNgo) ngoId = managedNgo._id
    }

    if (!ngoId) {
      return res.status(400).json({ error: 'No NGO associated with your account' })
    }

    const filter = { ngoId }
    if (status) filter.status = status

    const applications = await VolunteerApplication.find(filter)
      .populate(
        'volunteerId',
        'fullName email phone location locationName volunteerProfile'
      )
      .populate('ngoId', 'name')
      .sort({ createdAt: -1 })

    res.json({ success: true, applications })
  } catch (error) {
    console.error('Volunteer apps error:', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
}

// ══════════════════════════════════════════════════════════════
// Approve/Reject volunteer application
// ══════════════════════════════════════════════════════════════
exports.reviewVolunteerApplication = async (req, res) => {
  try {
    const { applicationId } = req.params
    const { action, rejectionReason } = req.body

    const application = await VolunteerApplication.findById(applicationId)
    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Get the user's NGO ID
    const userNgoId = req.user.ngo?._id
      ? req.user.ngo._id.toString()
      : req.user.ngo
        ? req.user.ngo.toString()
        : null

    const appNgoId = application.ngoId.toString()

    // Check authorization
    let isAuthorized = false

    if (userNgoId && userNgoId === appNgoId) {
      isAuthorized = true
    }

    // If ngo_manager, also check via NGO.managedBy
    if (!isAuthorized && req.user.roleName === 'ngo_manager') {
      const ngo = await NGO.findOne({
        _id: application.ngoId,
        managedBy: req.user._id,
      })
      if (ngo) isAuthorized = true
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Not authorized to review this application',
      })
    }

    if (action === 'approve') {
      application.status = 'approved'
      application.approvedAt = new Date()

      await User.findByIdAndUpdate(application.volunteerId, {
        $addToSet: {
          approvedNgos: {
            ngoId: application.ngoId,
            approvedAt: new Date(),
            approvedBy: req.user._id,
          },
        },
        $set: { status: 'active' },
      })
    } else if (action === 'reject') {
      application.status = 'rejected'
      application.rejectedAt = new Date()
      application.rejectionReason = rejectionReason || ''
    } else {
      return res.status(400).json({ error: 'Action must be approve or reject' })
    }

    await application.save()

    res.json({
      success: true,
      message: `Application ${action}d successfully`,
      application,
    })
  } catch (error) {
    console.error('Review app error:', error)
    res.status(500).json({ error: 'Failed to review application' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get zone tasks
// ══════════════════════════════════════════════════════════════
exports.getZoneTasks = async (req, res) => {
  try {
    const { status } = req.query

    let ngoId = req.user.ngo?._id || req.user.ngo || null
    if (!ngoId && req.user.roleName === 'ngo_manager') {
      const managedNgo = await NGO.findOne({ managedBy: req.user._id })
      if (managedNgo) ngoId = managedNgo._id
    }

    const filter = {}
    if (ngoId) filter.ngoId = ngoId
    if (status) filter.status = status

    const tasks = await Task.find(filter)
      .populate('reportId', 'title analysis fileUrl fileType')
      .populate('ngoId', 'name')
      .populate(
        'assignedVolunteers.volunteerId',
        'fullName email phone location locationName'
      )
      .sort({ createdAt: -1 })

    res.json({ success: true, tasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get approved volunteers
// ══════════════════════════════════════════════════════════════
exports.getApprovedVolunteers = async (req, res) => {
  try {
    let ngoId = req.user.ngo?._id || req.user.ngo || null
    if (!ngoId && req.user.roleName === 'ngo_manager') {
      const managedNgo = await NGO.findOne({ managedBy: req.user._id })
      if (managedNgo) ngoId = managedNgo._id
    }

    if (!ngoId) {
      return res.json({ success: true, volunteers: [] })
    }

    const approvedApps = await VolunteerApplication.find({
      ngoId,
      status: 'approved',
    }).select('volunteerId')

    const volunteerIds = approvedApps.map((a) => a.volunteerId)

    const volunteers = await User.find({
      _id: { $in: volunteerIds },
      status: 'active',
    }).select('fullName email phone location locationName volunteerProfile')

    const profiles = await VolunteerProfile.find({
      userId: { $in: volunteerIds },
    }).select(
      'userId availabilityStatus currentTaskId busyUntil skills rating tasksCompleted location locationName'
    )

    const profileMap = {}
    profiles.forEach((p) => {
      profileMap[p.userId.toString()] = p
    })

    const result = volunteers.map((v) => {
      const profile = profileMap[v._id.toString()]
      return {
        _id: v._id,
        fullName: v.fullName,
        email: v.email,
        phone: v.phone,
        location: profile?.location || v.location,
        locationName: profile?.locationName || v.locationName,
        availabilityStatus: profile?.availabilityStatus || 'FREE',
        currentTaskId: profile?.currentTaskId,
        busyUntil: profile?.busyUntil,
        skills: profile?.skills || v.volunteerProfile?.skills || [],
        rating: profile?.rating || 0,
        tasksCompleted: profile?.tasksCompleted || 0,
      }
    })

    res.json({ success: true, volunteers: result })
  } catch (error) {
    console.error('Get volunteers error:', error)
    res.status(500).json({ error: 'Failed to fetch volunteers' })
  }
}

// ══════════════════════════════════════════════════════════════
// Get committee profile
// ══════════════════════════════════════════════════════════════
exports.getCommitteeProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate(
        'ngo',
        'name description website contactEmail status location locationName managedBy approvedAt'
      )
      .populate(
        'zone',
        'name description city state country pincode latitude longitude locationName'
      )
      .populate('committeeProfile.appointedBy', 'fullName email')
      .select('-password')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const zoneId = user.zone?._id
    const ngoId = user.ngo?._id

    const [
      totalReports,
      criticalReports,
      resolvedReports,
      staffCount,
      approvedVolunteers,
      activeTasks,
      completedTasks,
    ] = await Promise.all([
      zoneId
        ? Report.countDocuments({ zone: zoneId, visibility: 'sent' })
        : 0,
      zoneId
        ? Report.countDocuments({
            zone: zoneId,
            visibility: 'sent',
            'analysis.severityLevel': 'critical',
          })
        : 0,
      zoneId
        ? Report.countDocuments({
            zone: zoneId,
            visibility: 'sent',
            status: 'resolved',
          })
        : 0,
      zoneId
        ? User.countDocuments({
            zone: zoneId,
            roleName: 'ngo_staff',
            status: 'active',
          })
        : 0,
      ngoId
        ? VolunteerApplication.countDocuments({
            ngoId,
            status: 'approved',
          })
        : 0,
      ngoId
        ? Task.countDocuments({
            ngoId,
            status: { $in: ['open', 'in-progress'] },
          })
        : 0,
      ngoId ? Task.countDocuments({ ngoId, status: 'completed' }) : 0,
    ])

    let ngoManager = null
    if (user.ngo?.managedBy) {
      ngoManager = await User.findById(user.ngo.managedBy).select(
        'fullName email phone'
      )
    }

    res.json({
      success: true,
      profile: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          status: user.status,
          location: user.location,
          locationName: user.locationName,
          createdAt: user.createdAt,
          committeeProfile: user.committeeProfile,
        },
        ngo: user.ngo,
        ngoManager,
        zone: user.zone,
        stats: {
          totalReports,
          criticalReports,
          resolvedReports,
          staffCount,
          approvedVolunteers,
          activeTasks,
          completedTasks,
        },
      },
    })
  } catch (error) {
    console.error('Profile error:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}