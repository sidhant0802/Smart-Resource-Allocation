const WorkerAssignment = require('../models/WorkerAssignment')
const Task = require('../models/Task')
const Report = require('../models/Report')
const User = require('../models/User')
const VolunteerProfile = require('../models/VolunteerProfile')
const NGO = require('../models/NGO')
const crypto = require('crypto')
const assignmentEmailService = require('../services/assignment.email.service')

// ══════════════════════════════════════════════════════════════
// CREATE WORKER ASSIGNMENT (after approving report)
// ══════════════════════════════════════════════════════════════
exports.createAssignment = async (req, res) => {
  try {
    const { reportId, taskId, totalSlotsNeeded, durationDays, startDate } = req.body

    // Validate inputs
    if (!reportId || !taskId || !totalSlotsNeeded || !durationDays || !startDate) {
      return res.status(400).json({
        error: 'Missing required fields: reportId, taskId, totalSlotsNeeded, durationDays, startDate'
      })
    }

    // Get report and task
    const report = await Report.findById(reportId)
    const task = await Task.findById(taskId)

    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    // Verify authorization - only committee member can create assignment
    if (req.user.roleName !== 'committee_member') {
      return res.status(403).json({
        error: 'Only committee members can create assignments'
      })
    }

    // Create slots
    const slots = []
    for (let i = 1; i <= totalSlotsNeeded; i++) {
      slots.push({
        slotNumber: i,
        status: 'pending_assignment'
      })
    }

    // Calculate end date
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + durationDays)

    // Create assignment
    const assignment = new WorkerAssignment({
      reportId,
      taskId,
      ngoId: task.ngoId,
      createdBy: req.user._id,
      totalSlotsNeeded,
      filledSlots: 0,
      durationDays,
      startDate: start,
      endDate: end,
      slots,
      assignmentStatus: 'draft',
      notes: `Assignment created for report "${report.title}" with ${totalSlotsNeeded} slots needed for ${durationDays} days`
    })

    await assignment.save()

    // Link assignment to task
    task.assignmentId = assignment._id
    await task.save()

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      assignment: {
        _id: assignment._id,
        totalSlotsNeeded: assignment.totalSlotsNeeded,
        filledSlots: assignment.filledSlots,
        progress: assignment.getProgress(),
        durationDays: assignment.durationDays,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        assignmentStatus: assignment.assignmentStatus,
        slots: assignment.slots
      }
    })
  } catch (error) {
    console.error('Create assignment error:', error)
    res.status(500).json({ error: 'Failed to create assignment' })
  }
}

// ══════════════════════════════════════════════════════════════
// ASSIGN VOLUNTEER TO SPECIFIC SLOT
// ══════════════════════════════════════════════════════════════
exports.assignVolunteerToSlot = async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { volunteerId, slotNumber } = req.body

    if (!volunteerId || !slotNumber) {
      return res.status(400).json({
        error: 'Missing required fields: volunteerId, slotNumber'
      })
    }

    // Get assignment
    const assignment = await WorkerAssignment.findById(assignmentId)
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    // Verify authorization
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Not authorized to modify this assignment'
      })
    }

    // Get volunteer
    const volunteer = await User.findById(volunteerId)
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' })
    }

    // Check if already fully assigned
    if (assignment.isFullyAssigned()) {
      return res.status(400).json({
        error: `All ${assignment.totalSlotsNeeded} slots are already filled!`
      })
    }

    // Find the slot
    const slot = assignment.slots.find(s => s.slotNumber === slotNumber)
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' })
    }

    // Check if slot is available
    if (slot.status !== 'pending_assignment') {
      return res.status(400).json({
        error: `Slot ${slotNumber} is not available (current status: ${slot.status})`
      })
    }

    // Generate approval token (24 hour expiry)
    const token = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update slot with volunteer info
    slot.volunteerId = volunteer._id
    slot.email = volunteer.email
    slot.phone = volunteer.phone
    slot.fullName = volunteer.fullName
    slot.status = 'assignment_sent'
    slot.assignmentEmailSentAt = new Date()
    slot.assignmentEmailToken = token
    slot.assignmentEmailTokenExpiry = tokenExpiry

    // Get NGO name
    const ngo = await NGO.findById(assignment.ngoId)
    const task = await Task.findById(assignment.taskId)

    // Send email
    const emailResult = await assignmentEmailService.sendWorkerAssignmentEmail({
      volunteerId: volunteer._id,
      volunteerEmail: volunteer.email,
      volunteerName: volunteer.fullName,
      taskTitle: task.title,
      taskDescription: task.description,
      durationDays: assignment.durationDays,
      slotNumber: slot.slotNumber,
      totalSlots: assignment.totalSlotsNeeded,
      assignmentToken: token,
      tokenExpiry: slot.assignmentEmailTokenExpiry,
      ngoName: ngo.name
    })

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Email failed to send',
        details: emailResult.error
      })
    }

    // Update assignment status
    if (assignment.assignmentStatus === 'draft') {
      assignment.assignmentStatus = 'pending'
    }

    await assignment.save()

    res.json({
      success: true,
      message: `Email sent to ${volunteer.fullName}. Waiting for approval.`,
      slot: {
        slotNumber: slot.slotNumber,
        volunteerId: slot.volunteerId,
        volunteerName: slot.fullName,
        email: slot.email,
        status: slot.status,
        assignmentEmailSentAt: slot.assignmentEmailSentAt
      },
      progress: assignment.getProgress(),
      assignmentStatus: assignment.assignmentStatus
    })
  } catch (error) {
    console.error('Assign volunteer error:', error)
    res.status(500).json({ error: 'Failed to assign volunteer' })
  }
}

// ══════════════════════════════════════════════════════════════
// VOLUNTEER APPROVES ASSIGNMENT (via email link)
// ══════════════════════════════════════════════════════════════
exports.volunteerApproveAssignment = async (req, res) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({ error: 'No token provided' })
    }

    // Find assignment with matching token
    const assignment = await WorkerAssignment.findOne({
      'slots.assignmentEmailToken': token
    })

    if (!assignment) {
      return res.status(404).json({ error: 'Invalid or expired token' })
    }

    // Find the slot with this token
    const slot = assignment.slots.find(s => s.assignmentEmailToken === token)

    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' })
    }

    // Check if token is expired
    if (new Date() > new Date(slot.assignmentEmailTokenExpiry)) {
      return res.status(400).json({ error: 'Token has expired. Please wait for a new assignment.' })
    }

    // Check if already approved/rejected
    if (slot.status === 'approved') {
      return res.status(400).json({ error: 'You already approved this assignment' })
    }
    if (slot.status === 'rejected') {
      return res.status(400).json({ error: 'You already rejected this assignment' })
    }

    // Update slot status
    slot.status = 'approved'
    slot.approvalResponseAt = new Date()

    // Increment filled slots
    assignment.filledSlots += 1

    // Get volunteer and task for email
    const volunteer = await User.findById(slot.volunteerId)
    const task = await Task.findById(assignment.taskId)
    const ngo = await NGO.findById(assignment.ngoId)

    // Send confirmation email
    await assignmentEmailService.sendApprovalConfirmationEmail({
      volunteerEmail: volunteer.email,
      volunteerName: volunteer.fullName,
      taskTitle: task.title,
      durationDays: assignment.durationDays,
      slotNumber: slot.slotNumber,
      totalSlots: assignment.totalSlotsNeeded,
      ngoName: ngo.name,
      startDate: assignment.startDate
    })

    // Check if all slots are now filled
    if (assignment.isFullyAssigned()) {
      assignment.assignmentStatus = 'active'

      // Update task status
      task.status = 'in-progress'
      task.assignedVolunteers = assignment.slots.map(s => ({
        volunteerId: s.volunteerId,
        status: 'accepted'
      }))
      await task.save()

      // Update volunteer profiles
      for (const s of assignment.slots) {
        await VolunteerProfile.findOneAndUpdate(
          { userId: s.volunteerId },
          {
            availabilityStatus: 'BUSY',
            currentTaskId: assignment.taskId,
            busyUntil: assignment.endDate
          }
        )
      }
    }

    await assignment.save()

    res.json({
      success: true,
      message: `✅ You approved slot ${slot.slotNumber}/${assignment.totalSlotsNeeded}!`,
      progress: assignment.getProgress(),
      isFullyAssigned: assignment.isFullyAssigned(),
      assignmentStatus: assignment.assignmentStatus,
      volunteerId: slot.volunteerId
    })
  } catch (error) {
    console.error('Volunteer approve error:', error)
    res.status(500).json({ error: 'Failed to process approval' })
  }
}

// ══════════════════════════════════════════════════════════════
// VOLUNTEER REJECTS ASSIGNMENT (via email link)
// ══════════════════════════════════════════════════════════════
exports.volunteerRejectAssignment = async (req, res) => {
  try {
    const { token } = req.params
    const { reason } = req.body

    if (!token) {
      return res.status(400).json({ error: 'No token provided' })
    }

    // Find assignment with matching token
    const assignment = await WorkerAssignment.findOne({
      'slots.assignmentEmailToken': token
    })

    if (!assignment) {
      return res.status(404).json({ error: 'Invalid or expired token' })
    }

    // Find the slot
    const slot = assignment.slots.find(s => s.assignmentEmailToken === token)

    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' })
    }

    // Check if token expired
    if (new Date() > new Date(slot.assignmentEmailTokenExpiry)) {
      return res.status(400).json({ error: 'Token expired' })
    }

    // Store volunteer email before clearing slot
    const volunteerEmail = slot.email
    const volunteerName = slot.fullName
    const volunteerId = slot.volunteerId

    // Reset slot for next assignment
    slot.status = 'pending_assignment'
    slot.assignmentEmailToken = null
    slot.assignmentEmailTokenExpiry = null
    slot.volunteerId = null
    slot.email = null
    slot.phone = null
    slot.fullName = null
    slot.approvalResponseAt = new Date()
    slot.approvalNotes = reason || 'Rejected'

    const task = await Task.findById(assignment.taskId)
    const ngo = await NGO.findById(assignment.ngoId)

    // Send rejection notification
    await assignmentEmailService.sendRejectionNotificationEmail({
      volunteerEmail: volunteerEmail,
      volunteerName: volunteerName,
      taskTitle: task.title,
      ngoName: ngo.name
    })

    await assignment.save()

    res.json({
      success: true,
      message: 'Assignment declined. Slot is now open for another volunteer.',
      progress: assignment.getProgress(),
      nextAvailableSlot: assignment.getNextAvailableSlot()
    })
  } catch (error) {
    console.error('Volunteer reject error:', error)
    res.status(500).json({ error: 'Failed to process rejection' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET ASSIGNMENT DETAILS WITH PROGRESS
// ══════════════════════════════════════════════════════════════
exports.getAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params

    const assignment = await WorkerAssignment.findById(assignmentId)
      .populate('reportId', 'title analysis fileUrl fileType')
      .populate('taskId', 'title description category urgencyScore')
      .populate('ngoId', 'name')
      .populate('createdBy', 'fullName email')
      .populate('slots.volunteerId', 'fullName email phone')

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const slotsWithDetails = assignment.slots.map(slot => ({
      slotNumber: slot.slotNumber,
      status: slot.status,
      volunteer: slot.volunteerId ? {
        _id: slot.volunteerId._id,
        fullName: slot.volunteerId.fullName,
        email: slot.volunteerId.email,
        phone: slot.volunteerId.phone
      } : null,
      assignmentEmailSentAt: slot.assignmentEmailSentAt,
      approvalResponseAt: slot.approvalResponseAt,
      createdAt: slot.createdAt
    }))

    res.json({
      success: true,
      assignment: {
        _id: assignment._id,
        report: assignment.reportId,
        task: assignment.taskId,
        ngo: assignment.ngoId,
        createdBy: assignment.createdBy,
        totalSlotsNeeded: assignment.totalSlotsNeeded,
        filledSlots: assignment.filledSlots,
        progress: assignment.getProgress(),
        durationDays: assignment.durationDays,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        assignmentStatus: assignment.assignmentStatus,
        slots: slotsWithDetails,
        notes: assignment.notes,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt
      }
    })
  } catch (error) {
    console.error('Get assignment error:', error)
    res.status(500).json({ error: 'Failed to fetch assignment' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET COMMITTEE'S ASSIGNMENTS
// ══════════════════════════════════════════════════════════════
exports.getCommitteeAssignments = async (req, res) => {
  try {
    const { status } = req.query

    const filter = {
      createdBy: req.user._id
    }

    if (status) filter.assignmentStatus = status

    const assignments = await WorkerAssignment.find(filter)
      .populate('reportId', 'title analysis')
      .populate('taskId', 'title category')
      .populate('ngoId', 'name')
      .populate('slots.volunteerId', 'fullName email')
      .sort({ createdAt: -1 })

    const result = assignments.map(a => ({
      _id: a._id,
      report: a.reportId,
      task: a.taskId,
      ngo: a.ngoId,
      progress: a.getProgress(),
      filledSlots: a.filledSlots,
      totalSlotsNeeded: a.totalSlotsNeeded,
      assignmentStatus: a.assignmentStatus,
      durationDays: a.durationDays,
      startDate: a.startDate,
      endDate: a.endDate,
      pendingSlots: a.slots.filter(s => s.status === 'pending_approval').length,
      approvedSlots: a.slots.filter(s => s.status === 'approved').length,
      rejectedSlots: a.slots.filter(s => s.status === 'rejected').length,
      createdAt: a.createdAt
    }))

    res.json({
      success: true,
      count: result.length,
      assignments: result
    })
  } catch (error) {
    console.error('Get committee assignments error:', error)
    res.status(500).json({ error: 'Failed to fetch assignments' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET VOLUNTEER'S PENDING ASSIGNMENTS
// ══════════════════════════════════════════════════════════════
exports.getVolunteerPendingAssignments = async (req, res) => {
  try {
    const assignments = await WorkerAssignment.find({
      'slots.volunteerId': req.user._id,
      'slots.status': { $in: ['pending_approval', 'approved'] }
    })
      .populate('reportId', 'title')
      .populate('taskId', 'title description category locationName')
      .populate('ngoId', 'name')
      .sort({ createdAt: -1 })

    const result = assignments.map(a => {
      const mySlots = a.slots.filter(s => s.volunteerId && s.volunteerId.toString() === req.user._id.toString())
      return {
        _id: a._id,
        task: a.taskId,
        ngo: a.ngoId,
        mySlots,
        progress: a.getProgress(),
        durationDays: a.durationDays,
        startDate: a.startDate,
        endDate: a.endDate,
        assignmentStatus: a.assignmentStatus
      }
    })

    res.json({
      success: true,
      count: result.length,
      assignments: result
    })
  } catch (error) {
    console.error('Get volunteer assignments error:', error)
    res.status(500).json({ error: 'Failed to fetch assignments' })
  }
}