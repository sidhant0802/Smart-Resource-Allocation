const User = require('../models/User')
const NGO = require('../models/NGO')
const Zone = require('../models/Zone')
const Report = require('../models/Report')
const Task = require('../models/Task')
const VolunteerApplication = require('../models/VolunteerApplication')
const VolunteerProfile = require('../models/VolunteerProfile')

// ── Helper: Get manager's NGO ID ─────────────────────────────
async function getManagerNgoId(user) {
  if (user.ngo?._id) return user.ngo._id
  if (user.ngo) return user.ngo
  const ngo = await NGO.findOne({ managedBy: user._id })
  return ngo?._id || null
}

// ══════════════════════════════════════════════════════════════
// GET DASHBOARD
// ══════════════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)

    if (!ngoId) {
      return res.json({
        ngo: null,
        stats: {},
        zones: [],
        pendingCommittee: [],
        pendingStaff: [],
        committeeMembers: [],
        ngoStaff: [],
        volunteers: [],
      })
    }

    // Get NGO
    const ngo = await NGO.findById(ngoId)
    if (!ngo) {
      return res.json({ ngo: null, stats: {}, zones: [] })
    }

    // Get Zones
    const zones = await Zone.find({ ngo: ngoId })
      .populate('committeeMembers', 'fullName email phone status locationName')
      .sort({ createdAt: -1 })

    const zoneIds = zones.map((z) => z._id)

    // Get pending committee members (signed up for this NGO, pending)
    const pendingCommittee = await User.find({
      ngo: ngoId,
      roleName: 'committee_member',
      status: 'pending',
    }).select('fullName email phone locationName location createdAt')

    // Get pending staff
    const pendingStaff = await User.find({
      ngo: ngoId,
      roleName: 'ngo_staff',
      status: 'pending',
    }).select('fullName email phone locationName location createdAt')

    // Get active committee members
    const committeeMembers = await User.find({
      ngo: ngoId,
      roleName: 'committee_member',
      status: 'active',
    }).select('fullName email phone status locationName zone')

    // Get active staff
    const ngoStaff = await User.find({
      ngo: ngoId,
      roleName: 'ngo_staff',
      status: 'active',
    }).select('fullName email phone status locationName zone')

    // Get approved volunteers
    const approvedApps = await VolunteerApplication.find({
      ngoId,
      status: 'approved',
    }).select('volunteerId')

    const volunteerIds = approvedApps.map((a) => a.volunteerId)
    const volunteers = await User.find({
      _id: { $in: volunteerIds },
    }).select('fullName email phone status volunteerProfile locationName')

   // ✅ Get full volunteer application data, not just count
const pendingVolunteerApps = await VolunteerApplication.find({
  ngoId,
  status: 'pending',
})
  .populate('volunteerId', 'fullName email phone locationName location volunteerProfile')
  .sort({ createdAt: -1 })

    // Report stats
    const totalReports = await Report.countDocuments({ ngo: ngoId })
    const sentReports = await Report.countDocuments({
      ngo: ngoId,
      visibility: 'sent',
    })
    const criticalReports = await Report.countDocuments({
      ngo: ngoId,
      visibility: 'sent',
      'analysis.severityLevel': 'critical',
    })
    const pendingReviewReports = await Report.countDocuments({
      ngo: ngoId,
      visibility: 'sent',
      status: 'analyzed',
    })
    const resolvedReports = await Report.countDocuments({
      ngo: ngoId,
      visibility: 'sent',
      status: 'resolved',
    })

    // Task stats
    const activeTasks = await Task.countDocuments({
      ngoId,
      status: { $in: ['open', 'in-progress'] },
    })
    const completedTasks = await Task.countDocuments({
      ngoId,
      status: 'completed',
    })

    const stats = {
      totalZones: zones.length,
      totalCommitteeMembers: committeeMembers.length,
      totalStaff: ngoStaff.length,
      totalVolunteers: volunteers.length,
      pendingApprovals:
  pendingCommittee.length + pendingStaff.length + pendingVolunteerApps.length,
      pendingCommittee: pendingCommittee.length,
      pendingStaffCount: pendingStaff.length,
      pendingVolunteers: pendingVolunteerApps.length,
      totalReports,
      sentReports,
      criticalReports,
      pendingReviewReports,
      resolvedReports,
      activeTasks,
      completedTasks,
      totalPeople:
        committeeMembers.length +
        ngoStaff.length +
        volunteers.length,
    }

        res.json({
      ngo,
      stats,
      zones,
      pendingCommittee,
      pendingStaff,
      pendingVolunteers: pendingVolunteerApps,  // ✅ ADD THIS
      committeeMembers,
      ngoStaff,
      volunteers,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
}

// ══════════════════════════════════════════════════════════════
// CREATE ZONE
// ══════════════════════════════════════════════════════════════
exports.createZone = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    if (!ngoId) return res.status(400).json({ error: 'No NGO found' })

    const {
      name,
      description,
      latitude,
      longitude,
      locationName,
      city,
      state,
      country,
      pincode,
    } = req.body

    if (!name || !latitude || !longitude) {
      return res
        .status(400)
        .json({ error: 'Name and location are required' })
    }

    const zone = await Zone.create({
      name,
      description,
      ngo: ngoId,
      latitude,
      longitude,
      locationName,
      city,
      state,
      country: country || 'India',
      pincode,
      createdBy: req.user._id,
      status: 'active',
    })

    res.status(201).json({ success: true, zone })
  } catch (error) {
    console.error('Create zone error:', error)
    res.status(500).json({ error: 'Failed to create zone' })
  }
}

// ══════════════════════════════════════════════════════════════
// DELETE ZONE
// ══════════════════════════════════════════════════════════════
exports.deleteZone = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    const zone = await Zone.findOne({ _id: req.params.zoneId, ngo: ngoId })

    if (!zone) return res.status(404).json({ error: 'Zone not found' })

    await Zone.findByIdAndDelete(zone._id)

    res.json({ success: true, message: 'Zone deleted' })
  } catch (error) {
    console.error('Delete zone error:', error)
    res.status(500).json({ error: 'Failed to delete zone' })
  }
}

// ══════════════════════════════════════════════════════════════
// APPROVE COMMITTEE MEMBER
// ══════════════════════════════════════════════════════════════
exports.approveCommittee = async (req, res) => {
  try {
    const { memberId, zoneId } = req.body
    const ngoId = await getManagerNgoId(req.user)

    const member = await User.findOne({
      _id: memberId,
      ngo: ngoId,
      roleName: 'committee_member',
      status: 'pending',
    })

    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }

    // If zone provided, check if zone already has a committee member
    if (zoneId) {
      const zone = await Zone.findById(zoneId)
      if (zone && zone.committeeMembers && zone.committeeMembers.length > 0) {
        return res.status(400).json({
          error: 'This zone already has a committee member. Each zone can have only one.',
        })
      }

      member.zone = zoneId
      await Zone.findByIdAndUpdate(zoneId, {
        $addToSet: { committeeMembers: memberId },
      })
    }

    member.status = 'active'
    member.committeeProfile = {
      ...member.committeeProfile,
      appointedBy: req.user._id,
      appointedAt: new Date(),
    }
    await member.save()

    res.json({ success: true, message: 'Committee member approved' })
  } catch (error) {
    console.error('Approve committee error:', error)
    res.status(500).json({ error: 'Failed to approve' })
  }
}

// ══════════════════════════════════════════════════════════════
// APPROVE STAFF
// ══════════════════════════════════════════════════════════════
exports.approveStaff = async (req, res) => {
  try {
    const { memberId, zoneId } = req.body
    const ngoId = await getManagerNgoId(req.user)

    const member = await User.findOne({
      _id: memberId,
      ngo: ngoId,
      roleName: 'ngo_staff',
      status: 'pending',
    })

    if (!member) {
      return res.status(404).json({ error: 'Staff not found' })
    }

    if (zoneId) {
      member.zone = zoneId
    }

    member.status = 'active'
    member.staffProfile = {
      ...member.staffProfile,
      appointedBy: req.user._id,
      appointedAt: new Date(),
    }
    await member.save()

    res.json({ success: true, message: 'Staff approved' })
  } catch (error) {
    console.error('Approve staff error:', error)
    res.status(500).json({ error: 'Failed to approve' })
  }
}

// ══════════════════════════════════════════════════════════════
// DECLINE USER
// ══════════════════════════════════════════════════════════════
exports.declineUser = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    const member = await User.findOne({
      _id: req.params.memberId,
      ngo: ngoId,
      status: 'pending',
    })

    if (!member) {
      return res.status(404).json({ error: 'User not found' })
    }

    member.status = 'inactive'
    await member.save()

    res.json({ success: true, message: 'User declined' })
  } catch (error) {
    console.error('Decline error:', error)
    res.status(500).json({ error: 'Failed to decline' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET ALL NGO REPORTS (all staff reports for this NGO)
// ══════════════════════════════════════════════════════════════
exports.getNgoReports = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    if (!ngoId) {
      return res.status(400).json({ error: 'No NGO found' })
    }

    const { status, severity, visibility, search } = req.query

    const filter = { ngo: ngoId }

    if (status) filter.status = status
    if (severity) filter['analysis.severityLevel'] = severity
    if (visibility) filter.visibility = visibility

    const reports = await Report.find(filter)
      .sort({ 'analysis.urgencyScore': -1, createdAt: -1 })
      .populate('submittedBy', 'fullName email phone locationName zone')
      .populate('zone', 'name')
      .populate('ngo', 'name')
      .populate('reviewedBy', 'fullName')

    // If search query, filter in memory
    let filtered = reports
    if (search) {
      const q = search.toLowerCase()
      filtered = reports.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.analysis?.category?.toLowerCase().includes(q) ||
          r.submittedBy?.fullName?.toLowerCase().includes(q) ||
          r.locationName?.toLowerCase().includes(q)
      )
    }

    // Get staff report counts
    const staffIds = [
      ...new Set(reports.map((r) => r.submittedBy?._id?.toString()).filter(Boolean)),
    ]
    const staffReportCounts = {}
    for (const sid of staffIds) {
      staffReportCounts[sid] = reports.filter(
        (r) => r.submittedBy?._id?.toString() === sid
      ).length
    }

    res.json({
      success: true,
      count: filtered.length,
      reports: filtered,
      staffReportCounts,
    })
  } catch (error) {
    console.error('Get NGO reports error:', error)
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
}

// ══════════════════════════════════════════════════════════════
// NGO MANAGER: Review report (same as committee)
// ══════════════════════════════════════════════════════════════
exports.reviewReport = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    const { reportId } = req.params
    const { status, reviewNotes } = req.body

    const validStatuses = ['reviewed', 'resolved', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const report = await Report.findOne({
      _id: reportId,
      ngo: ngoId,
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
    console.error('Review report error:', error)
    res.status(500).json({ error: 'Failed to review report' })
  }
}

// ══════════════════════════════════════════════════════════════
// NGO MANAGER: Delete report
// ══════════════════════════════════════════════════════════════
exports.deleteReport = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    const report = await Report.findOne({
      _id: req.params.reportId,
      ngo: ngoId,
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    await Report.findByIdAndDelete(report._id)

    res.json({ success: true, message: 'Report deleted' })
  } catch (error) {
    console.error('Delete report error:', error)
    res.status(500).json({ error: 'Failed to delete report' })
  }
}

// ══════════════════════════════════════════════════════════════
// NGO MANAGER: Get report stats
// ══════════════════════════════════════════════════════════════
exports.getReportStats = async (req, res) => {
  try {
    const ngoId = await getManagerNgoId(req.user)
    if (!ngoId) return res.json({ success: true, stats: {} })

    const [
      total,
      drafts,
      sent,
      critical,
      high,
      medium,
      low,
      pendingReview,
      reviewed,
      resolved,
      rejected,
    ] = await Promise.all([
      Report.countDocuments({ ngo: ngoId }),
      Report.countDocuments({ ngo: ngoId, visibility: 'draft' }),
      Report.countDocuments({ ngo: ngoId, visibility: 'sent' }),
      Report.countDocuments({
        ngo: ngoId,
        'analysis.severityLevel': 'critical',
      }),
      Report.countDocuments({
        ngo: ngoId,
        'analysis.severityLevel': 'high',
      }),
      Report.countDocuments({
        ngo: ngoId,
        'analysis.severityLevel': 'medium',
      }),
      Report.countDocuments({
        ngo: ngoId,
        'analysis.severityLevel': 'low',
      }),
      Report.countDocuments({ ngo: ngoId, visibility: 'sent', status: 'analyzed' }),
      Report.countDocuments({ ngo: ngoId, status: 'reviewed' }),
      Report.countDocuments({ ngo: ngoId, status: 'resolved' }),
      Report.countDocuments({ ngo: ngoId, status: 'rejected' }),
    ])

    // Per-staff breakdown
    const staffMembers = await User.find({
      ngo: ngoId,
      roleName: 'ngo_staff',
      status: 'active',
    }).select('fullName')

    const staffBreakdown = await Promise.all(
      staffMembers.map(async (s) => {
        const count = await Report.countDocuments({ submittedBy: s._id })
        const sentCount = await Report.countDocuments({
          submittedBy: s._id,
          visibility: 'sent',
        })
        return {
          _id: s._id,
          fullName: s.fullName,
          totalReports: count,
          sentReports: sentCount,
        }
      })
    )

    res.json({
      success: true,
      stats: {
        total,
        drafts,
        sent,
        critical,
        high,
        medium,
        low,
        pendingReview,
        reviewed,
        resolved,
        rejected,
        staffBreakdown,
      },
    })
  } catch (error) {
    console.error('Report stats error:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
}

// ══════════════════════════════════════════════════════════════
// APPROVE/REJECT VOLUNTEER APPLICATION
// ══════════════════════════════════════════════════════════════
exports.approveVolunteer = async (req, res) => {
  try {
    const { applicationId } = req.params
    const { action, rejectionReason } = req.body
    const ngoId = await getManagerNgoId(req.user)

    const application = await VolunteerApplication.findById(applicationId)
    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (application.ngoId.toString() !== ngoId.toString()) {
      return res.status(403).json({ error: 'Not authorized' })
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

      console.log(`✅ Volunteer approved for NGO: ${ngoId}`)
    } else if (action === 'reject') {
      application.status = 'rejected'
      application.rejectedAt = new Date()
      application.rejectionReason = rejectionReason || ''
    } else {
      return res.status(400).json({ error: 'Action must be approve or reject' })
    }

    await application.save()

    res.json({ success: true, message: `Volunteer ${action}d` })
  } catch (error) {
    console.error('Volunteer approval error:', error)
    res.status(500).json({ error: 'Failed to review volunteer' })
  }
}