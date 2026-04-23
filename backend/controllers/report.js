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
exports.getZoneStats = async (req, res) => {
  try {
    const zoneId = req.user.zone
    const ngoId = req.user.ngo?._id || req.user.ngo

    const [total, critical, high, pending, resolved, reviewed, rejected] =
      await Promise.all([
        Report.countDocuments({ zone: zoneId, visibility: 'sent' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'critical' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'high' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'analyzed' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'resolved' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'reviewed' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'rejected' }),
      ])

    const staffCount = await User.countDocuments({
      zone: zoneId, roleName: 'ngo_staff', status: 'active',
    })

    // ✅ Count pending staff in this zone's NGO
    const pendingStaffCount = await User.countDocuments({
      ngo: ngoId, roleName: 'ngo_staff', status: 'pending',
    })

    const volunteerAppCount = ngoId
      ? await VolunteerApplication.countDocuments({ ngoId, status: 'pending' })
      : 0

    const activeTasks = ngoId
      ? await Task.countDocuments({ ngoId, status: { $in: ['open', 'in-progress'] } })
      : 0

    const approvedVolunteers = ngoId
      ? await VolunteerApplication.countDocuments({ ngoId, status: 'approved' })
      : 0

    res.json({
      success: true,
      stats: {
        total, critical, high, pending, resolved, reviewed, rejected,
        staffCount,
        pendingStaffCount,
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

      // ✅ FIX: Update volunteer's approvedNgos array
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

      console.log(`✅ Volunteer application approved for NGO: ${application.ngoId}`)

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
// ══════════════════════════════════════════════════════════════
// COMMITTEE: Get pending staff needing approval
// ══════════════════════════════════════════════════════════════
exports.getZonePendingStaff = async (req, res) => {
  try {
    const ngoId = req.user.ngo?._id || req.user.ngo

    if (!ngoId) {
      return res.status(400).json({ error: 'No NGO associated with your account' })
    }

    const StaffApplication = require('../models/StaffApplication')

    // ✅ SOURCE 1: Users who registered with this NGO and are pending
    const pendingUsers = await User.find({
      ngo: ngoId,
      roleName: 'ngo_staff',
      status: 'pending',
    })
      .select('fullName email phone locationName location createdAt ngo status')
      .sort({ createdAt: -1 })

    // ✅ SOURCE 2: StaffApplications that are pending for this NGO
    const pendingApps = await StaffApplication.find({
      ngoId: ngoId,
      status: 'pending',
    })
      .populate(
        'userId',
        'fullName email phone locationName location createdAt status roleName ngo'
      )
      .sort({ createdAt: -1 })

    // ✅ Build result - merge both sources, no duplicates
    const resultMap = new Map()

    // Add from User model
    pendingUsers.forEach(u => {
      resultMap.set(u._id.toString(), {
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        locationName: u.locationName,
        location: u.location,
        createdAt: u.createdAt,
        source: 'registration',
        canReview: true,
      })
    })

    // Add from StaffApplication (if not already added)
    pendingApps.forEach(app => {
      if (!app.userId) return

      const uid = app.userId._id.toString()

      if (!resultMap.has(uid)) {
        resultMap.set(uid, {
          _id: app.userId._id,
          fullName: app.userId.fullName,
          email: app.userId.email,
          phone: app.userId.phone,
          locationName: app.userId.locationName,
          location: app.userId.location,
          createdAt: app.createdAt,
          applicationId: app._id,
          message: app.message,
          source: 'staff_application',
          canReview: true,
        })
      } else {
        // Update existing entry with app info
        const existing = resultMap.get(uid)
        existing.applicationId = app._id
        existing.message = app.message
        resultMap.set(uid, existing)
      }
    })

    const allPendingStaff = Array.from(resultMap.values())

    console.log(`📋 Pending staff for NGO ${ngoId}: ${allPendingStaff.length} total`)
    console.log(`   From registration: ${pendingUsers.length}`)
    console.log(`   From applications: ${pendingApps.length}`)

    res.json({
      success: true,
      staff: allPendingStaff,
      count: allPendingStaff.length,
    })
  } catch (error) {
    console.error('Pending staff error:', error)
    res.status(500).json({ error: 'Failed to fetch pending staff' })
  }
}
// ══════════════════════════════════════════════════════════════
// COMMITTEE: Approve/reject pending staff in their zone
// ══════════════════════════════════════════════════════════════
exports.reviewStaffApplication = async (req, res) => {
  try {
    const { staffId } = req.params
    const { action } = req.body

    const ngoId = req.user.ngo?._id || req.user.ngo
    const zoneId = req.user.zone

    if (!ngoId) {
      return res.status(400).json({ error: 'No NGO associated with your account' })
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' })
    }

    const StaffApplication = require('../models/StaffApplication')

    // ✅ Find the staff user - try multiple ways
    let staff = await User.findById(staffId)

    if (!staff) {
      return res.status(404).json({ error: 'User not found' })
    }

    // ✅ Check if this staff belongs to this NGO
    // Either via User.ngo field OR via StaffApplication
    const staffNgoId = staff.ngo?._id?.toString() || staff.ngo?.toString()
    const committeeNgoId = ngoId?.toString()

    let staffApp = await StaffApplication.findOne({
      userId: staffId,
      ngoId: ngoId,
    })

    const belongsToNgo = staffNgoId === committeeNgoId || staffApp !== null

    if (!belongsToNgo) {
      return res.status(404).json({
        error: 'Staff not found in your NGO',
        debug: { staffNgoId, committeeNgoId, hasApp: !!staffApp }
      })
    }

    // ✅ Check role
    if (staff.roleName !== 'ngo_staff') {
      return res.status(400).json({ error: 'User is not an NGO staff member' })
    }

    // ✅ Allow review if status is pending OR if StaffApplication is pending
    // (staff applied via applyToNgo flow - their User.status might be 'active' already)
    const canReview =
      staff.status === 'pending' ||
      (staffApp && staffApp.status === 'pending')

    if (!canReview) {
      return res.status(400).json({
        error: `Cannot review: User status is "${staff.status}"${staffApp ? `, Application status is "${staffApp.status}"` : ', No application found'}`,
      })
    }

    if (action === 'approve') {
      // ✅ Update user
      staff.status = 'active'
      staff.zone = zoneId

      // ✅ Set staffProfile
      staff.staffProfile = {
        appointedBy: req.user._id,
        appointedAt: new Date(),
      }

      // ✅ Add NGO to approvedNgos array
      const alreadyInApprovedNgos = staff.approvedNgos?.some(
        a => a.ngoId?.toString() === committeeNgoId
      )

      if (!alreadyInApprovedNgos) {
        if (!staff.approvedNgos) staff.approvedNgos = []
        staff.approvedNgos.push({
          ngoId: ngoId,
          approvedAt: new Date(),
          approvedBy: req.user._id,
        })
      }

      // ✅ Make sure ngo field is set
      if (!staff.ngo) {
        staff.ngo = ngoId
      }

      await staff.save()

      // ✅ Update StaffApplication if exists
      if (staffApp) {
        staffApp.status = 'approved'
        staffApp.reviewedBy = req.user._id
        staffApp.reviewedAt = new Date()
        staffApp.reviewNote = 'Approved by committee'
        await staffApp.save()
      } else {
        // Create application record
        await StaffApplication.create({
          userId: staffId,
          ngoId: ngoId,
          status: 'approved',
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          reviewNote: 'Approved by committee',
        })
      }

      console.log(`✅ Staff approved: ${staff.fullName} → NGO: ${ngoId}, Zone: ${zoneId}`)

      return res.json({
        success: true,
        message: `${staff.fullName} approved successfully`,
        staff: {
          _id: staff._id,
          fullName: staff.fullName,
          status: staff.status,
          zone: zoneId,
          ngo: ngoId,
        }
      })

    } else if (action === 'reject') {

      staff.status = 'inactive'
      await staff.save()

      // ✅ Update StaffApplication if exists
      if (staffApp) {
        staffApp.status = 'rejected'
        staffApp.reviewedBy = req.user._id
        staffApp.reviewedAt = new Date()
        await staffApp.save()
      }

      console.log(`❌ Staff rejected: ${staff.fullName}`)

      return res.json({
        success: true,
        message: `${staff.fullName} rejected`
      })
    }

  } catch (error) {
    console.error('Review staff error:', error)
    res.status(500).json({ error: 'Failed to review staff: ' + error.message })
  }
}

// ══════════════════════════════════════════════════════════════
// COMMITTEE: Get zone stats - FIXED pending staff count
// ══════════════════════════════════════════════════════════════
exports.getZoneStats = async (req, res) => {
  try {
    const zoneId = req.user.zone
    const ngoId = req.user.ngo?._id || req.user.ngo

    const [total, critical, high, pending, resolved, reviewed, rejected] =
      await Promise.all([
        Report.countDocuments({ zone: zoneId, visibility: 'sent' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'critical' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', 'analysis.severityLevel': 'high' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'analyzed' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'resolved' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'reviewed' }),
        Report.countDocuments({ zone: zoneId, visibility: 'sent', status: 'rejected' }),
      ])

    const staffCount = await User.countDocuments({
      zone: zoneId,
      roleName: 'ngo_staff',
      status: 'active',
    })

    // ✅ FIX: Count pending staff from BOTH User model AND StaffApplication
    const StaffApplication = require('../models/StaffApplication')
    const [pendingFromUser, pendingFromApps] = await Promise.all([
      User.countDocuments({
        ngo: ngoId,
        roleName: 'ngo_staff',
        status: 'pending',
      }),
      StaffApplication.countDocuments({
        ngoId: ngoId,
        status: 'pending'
      })
    ])

    // ✅ Use the higher count (avoid double counting)
    const pendingStaffCount = Math.max(pendingFromUser, pendingFromApps)

    const volunteerAppCount = ngoId
      ? await VolunteerApplication.countDocuments({ ngoId, status: 'pending' })
      : 0

    const activeTasks = ngoId
      ? await Task.countDocuments({ ngoId, status: { $in: ['open', 'in-progress'] } })
      : 0

    const approvedVolunteers = ngoId
      ? await VolunteerApplication.countDocuments({ ngoId, status: 'approved' })
      : 0

    res.json({
      success: true,
      stats: {
        total, critical, high, pending, resolved, reviewed, rejected,
        staffCount,
        pendingStaffCount,
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