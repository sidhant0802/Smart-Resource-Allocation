const Task = require('../models/Task')
const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const User = require('../models/User')
const NGO = require('../models/NGO')

let emailService
try {
  emailService = require('../services/email.service')
} catch (err) {
  console.warn('⚠️  Email service not loaded')
  emailService = null
}

// ── Helper: Calculate distance between two coordinates ───────
function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2) return 0
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return parseFloat((R * c).toFixed(1))
}

// ── Helper: Find nearby active volunteers and notify them ────
async function notifyNearbyVolunteers(task) {
  try {
    if (!emailService) {
      console.warn('⚠️ Email service not available, skipping notifications')
      return { sent: 0, total: 0 }
    }

    const ngoId = task.ngoId
    const taskCoords = task.location?.coordinates

    // Step 1: Get all approved volunteer IDs for this NGO
    const approvedApps = await VolunteerApplication.find({
      ngoId,
      status: 'approved',
    }).select('volunteerId')

    const volunteerIds = approvedApps.map((a) => a.volunteerId)

    if (volunteerIds.length === 0) {
      console.log('📧 No approved volunteers to notify')
      return { sent: 0, total: 0 }
    }

    // Step 2: Get active volunteer users with emails
    const volunteers = await User.find({
      _id: { $in: volunteerIds },
      status: 'active',
    }).select('fullName email phone location locationName')

    if (volunteers.length === 0) {
      console.log('📧 No active volunteers found')
      return { sent: 0, total: 0 }
    }

    // Step 3: Get volunteer profiles for availability & location
    const profiles = await VolunteerProfile.find({
      userId: { $in: volunteerIds },
    }).select(
      'userId availabilityStatus location locationName maxDistance currentTaskId'
    )

    const profileMap = {}
    profiles.forEach((p) => {
      profileMap[p.userId.toString()] = p
    })

    // Step 4: Filter volunteers who are FREE and within range
    const maxNotifyRadius = 100 // km — max radius to notify

    const eligibleVolunteers = volunteers
      .map((vol) => {
        const profile = profileMap[vol._id.toString()]

        // Skip BUSY volunteers
        if (profile && profile.availabilityStatus !== 'FREE') {
          return null
        }

        // Calculate distance if task has location
        let distance = null
        if (taskCoords && taskCoords[0] !== 0 && taskCoords[1] !== 0) {
          const volCoords =
            profile?.location?.coordinates || vol.location?.coordinates
          if (volCoords && volCoords[0] !== 0 && volCoords[1] !== 0) {
            distance = calculateDistance(taskCoords, volCoords)

            // Use volunteer's preferred max distance or default
            const volMaxDistance = profile?.maxDistance || maxNotifyRadius
            if (distance > volMaxDistance && distance > maxNotifyRadius) {
              return null // Too far
            }
          }
        }

        return {
          _id: vol._id,
          fullName: vol.fullName,
          email: vol.email,
          locationName: profile?.locationName || vol.locationName,
          distance,
        }
      })
      .filter(Boolean)

    if (eligibleVolunteers.length === 0) {
      console.log('📧 No eligible (FREE + nearby) volunteers to notify')
      return { sent: 0, total: 0 }
    }

    // Sort by distance (nearest first)
    eligibleVolunteers.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })

    console.log(
      `📧 Notifying ${eligibleVolunteers.length} nearby volunteers about task: ${task.title}`
    )

    // Step 5: Send emails
    const result = await emailService.sendTaskNotificationToVolunteers(
      task,
      eligibleVolunteers
    )

    return result
  } catch (error) {
    console.error('❌ Error notifying volunteers:', error)
    return { sent: 0, total: 0, error: error.message }
  }
}
// ═══════════════════════════════════════════════════════════
// Create task + notify nearby volunteers
// ═══════════════════════════════════════════════════════════
exports.createTask = async (req, res) => {
  try {
    const {
      reportId,
      ngoId,
      title,
      description,
      category,
      location,
      locationName,
      volunteersNeeded,
      startDate,
      duration,
      urgencyScore,
      skillsRequired,
      affectedPeople,
    } = req.body

    // ✅ Validate required fields
    if (!reportId || !ngoId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: reportId, ngoId, title',
      })
    }

    // ✅ Safe parse numbers
    const parsedVolunteersNeeded = parseInt(volunteersNeeded) || 1
    const parsedDuration = parseInt(duration) || 1
    const parsedUrgencyScore = parseInt(urgencyScore) || 50
    const parsedAffectedPeople = parseInt(affectedPeople) || 0

    if (parsedVolunteersNeeded < 1) {
      return res.status(400).json({
        success: false,
        message: 'volunteersNeeded must be at least 1',
      })
    }

    if (parsedDuration < 1) {
      return res.status(400).json({
        success: false,
        message: 'duration must be at least 1 day',
      })
    }

    // ✅ Calculate end date
    const taskStartDate = startDate ? new Date(startDate) : new Date()
    const endDate = new Date(taskStartDate)
    endDate.setDate(endDate.getDate() + parsedDuration)

    const task = await Task.create({
      reportId,
      ngoId,
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'Community Development',
      location,
      locationName: locationName || '',
      volunteersNeeded: parsedVolunteersNeeded,
      startDate: taskStartDate,
      duration: parsedDuration,
      endDate,
      urgencyScore: parsedUrgencyScore,
      skillsRequired: Array.isArray(skillsRequired)
        ? skillsRequired.filter(Boolean)
        : [],
      affectedPeople: parsedAffectedPeople,
      status: 'open',
    })

    console.log(`✅ Task created: ${task._id} - "${task.title}"`)
    console.log(`   Volunteers needed: ${parsedVolunteersNeeded}, Duration: ${parsedDuration} days`)

    // ✅ Send email notifications to nearby approved volunteers
    let emailResult = { sent: 0, total: 0 }
    try {
      emailResult = await notifyNearbyVolunteers(task)
      console.log(`📧 Notifications: ${emailResult.sent}/${emailResult.total || 0} sent`)
    } catch (emailError) {
      console.error('⚠️ Email notification error (non-blocking):', emailError.message)
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
      notifications: {
        volunteersNotified: emailResult.sent || 0,
        totalEligible: emailResult.total || emailResult.sent || 0,
        details: emailResult.details || [],
      },
    })
  } catch (error) {
    console.error('❌ Error creating task:', error)
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message,
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Volunteer applies to task (needs committee approval)
// ═══════════════════════════════════════════════════════════
exports.applyToTask = async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user._id

    console.log(`📨 User ${userId} applying to task ${taskId}`)

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    if (task.status !== 'open') {
      return res
        .status(400)
        .json({ success: false, message: 'Task is no longer open' })
    }

    const alreadyAssigned = task.assignedVolunteers.find(
      (v) => v.volunteerId.toString() === userId.toString()
    )
    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: `Already ${alreadyAssigned.status} for this task`,
      })
    }

    const acceptedCount = task.assignedVolunteers.filter(
      (v) => v.status === 'accepted'
    ).length
    if (acceptedCount >= task.volunteersNeeded) {
      return res
        .status(400)
        .json({ success: false, message: 'Task is already fully staffed' })
    }

    const profile = await VolunteerProfile.findOne({ userId })
    if (profile && profile.availabilityStatus !== 'FREE') {
      return res
        .status(400)
        .json({ success: false, message: 'You are currently busy' })
    }

    task.assignedVolunteers.push({
      volunteerId: userId,
      status: 'pending_approval',
      respondedAt: new Date(),
    })

    await task.save()

    console.log('✅ Volunteer application submitted (pending approval)')

    res.status(200).json({
      success: true,
      message: 'Application submitted! Awaiting committee approval.',
      data: task,
    })
  } catch (error) {
    console.error('❌ Error applying to task:', error)
    res.status(500).json({
      success: false,
      message: 'Error applying to task',
      error: error.message,
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Committee approves/rejects volunteer application
// ═══════════════════════════════════════════════════════════
exports.reviewVolunteerApplication = async (req, res) => {
  try {
    const { taskId, volunteerId } = req.params
    const { action } = req.body

    console.log(
      `👥 Committee reviewing volunteer ${volunteerId} for task ${taskId}: ${action}`
    )

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    const assignment = task.assignedVolunteers.find(
      (v) => v.volunteerId.toString() === volunteerId
    )

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: 'Volunteer application not found' })
    }

    if (assignment.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Application already ${assignment.status}`,
      })
    }

    if (action === 'approve') {
      assignment.status = 'accepted'
      assignment.respondedAt = new Date()

      // Update volunteer profile to BUSY
      const profile = await VolunteerProfile.findOne({ userId: volunteerId })
      if (profile) {
        profile.availabilityStatus = 'BUSY'
        profile.currentTaskId = task._id
        profile.busyUntil = task.endDate
        await profile.save()
      }

      // Check if task is fully staffed
      const acceptedCount = task.assignedVolunteers.filter(
        (v) => v.status === 'accepted'
      ).length
      if (acceptedCount >= task.volunteersNeeded) {
        task.status = 'in-progress'
      }

      await task.save()

      // ✅ Send approval email to volunteer
      try {
        const volunteer = await User.findById(volunteerId).select(
          'fullName email'
        )
        if (volunteer && emailService) {
          await emailService.sendTaskAssignmentEmail(volunteer, task)
          console.log(`📧 Assignment email sent to ${volunteer.email}`)
        }
      } catch (emailErr) {
        console.error('⚠️ Assignment email failed:', emailErr.message)
      }

      console.log('✅ Volunteer approved for task')

      res.status(200).json({
        success: true,
        message: 'Volunteer approved successfully',
        data: task,
      })
    } else if (action === 'reject') {
      assignment.status = 'rejected'
      assignment.respondedAt = new Date()
      await task.save()

      console.log('❌ Volunteer rejected for task')

      res.status(200).json({
        success: true,
        message: 'Volunteer application rejected',
        data: task,
      })
    } else {
      return res.status(400).json({
        success: false,
        message: 'Action must be "approve" or "reject"',
      })
    }
  } catch (error) {
    console.error('❌ Error reviewing application:', error)
    res.status(500).json({
      success: false,
      message: 'Error reviewing application',
      error: error.message,
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Get pending volunteer applications for tasks in zone
// ═══════════════════════════════════════════════════════════
exports.getPendingApplications = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).select('zone ngo roleName')

    let query = {
      'assignedVolunteers.status': 'pending_approval',
    }

    // Get NGO ID
    let ngoId = user?.ngo?._id || user?.ngo || null
    if (!ngoId && user?.roleName === 'ngo_manager') {
      const managedNgo = await NGO.findOne({ managedBy: userId })
      if (managedNgo) ngoId = managedNgo._id
    }

    if (ngoId) {
      query.ngoId = ngoId
    } else if (user?.zone) {
      const Report = require('../models/Report')
      const zoneReports = await Report.find({ zone: user.zone }).select('_id')
      const reportIds = zoneReports.map((r) => r._id)
      query.reportId = { $in: reportIds }
    }

    const tasks = await Task.find(query)
      .populate('ngoId', 'name')
      .populate(
        'assignedVolunteers.volunteerId',
        'fullName email phone locationName'
      )
      .select(
        'title category locationName volunteersNeeded assignedVolunteers urgencyScore startDate duration'
      )
      .lean()

    const applications = []
    tasks.forEach((task) => {
      task.assignedVolunteers
        .filter((v) => v.status === 'pending_approval')
        .forEach((volunteer) => {
          applications.push({
            taskId: task._id,
            taskTitle: task.title,
            taskCategory: task.category,
            taskLocation: task.locationName,
            taskUrgency: task.urgencyScore,
            volunteersNeeded: task.volunteersNeeded,
            volunteersAccepted: task.assignedVolunteers.filter(
              (v) => v.status === 'accepted'
            ).length,
            ngo: task.ngoId || { name: 'Unknown' },
            volunteer: volunteer.volunteerId,
            appliedAt: volunteer.respondedAt,
          })
        })
    })

    console.log(`✅ Found ${applications.length} pending applications`)

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    })
  } catch (error) {
    console.error('❌ Error fetching pending applications:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching pending applications',
      error: error.message,
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Respond to task invitation (pre-invited)
// ═══════════════════════════════════════════════════════════
exports.respondToInvitation = async (req, res) => {
  try {
    const { taskId } = req.params
    const { response } = req.body
    const userId = req.user._id

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    const volunteerAssignment = task.assignedVolunteers.find(
      (v) => v.volunteerId.toString() === userId.toString()
    )

    if (!volunteerAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Not invited to this task' })
    }

    if (response === 'available') {
      volunteerAssignment.status = 'accepted'
      volunteerAssignment.respondedAt = new Date()

      const profile = await VolunteerProfile.findOne({ userId })
      if (profile) {
        profile.availabilityStatus = 'PENDING'
        await profile.save()
      }
    } else {
      volunteerAssignment.status = 'rejected'
      volunteerAssignment.respondedAt = new Date()
    }

    await task.save()

    res
      .status(200)
      .json({ success: true, message: 'Response submitted', data: task })
  } catch (error) {
    console.error('❌ Error:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error', error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════
// Assign volunteers
// ═══════════════════════════════════════════════════════════
exports.assignVolunteers = async (req, res) => {
  try {
    const { taskId } = req.params
    const { volunteerIds } = req.body

    if (
      !volunteerIds ||
      !Array.isArray(volunteerIds) ||
      volunteerIds.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid volunteer IDs' })
    }

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    for (const volunteerId of volunteerIds) {
      const profile = await VolunteerProfile.findOne({ userId: volunteerId })
      if (profile) {
        profile.availabilityStatus = 'BUSY'
        profile.currentTaskId = taskId
        profile.busyUntil = task.endDate
        await profile.save()
      }

      const assignment = task.assignedVolunteers.find(
        (v) => v.volunteerId.toString() === volunteerId
      )
      if (assignment) {
        assignment.status = 'accepted'
      }

      // ✅ Send assignment email
      try {
        const volunteer = await User.findById(volunteerId).select(
          'fullName email'
        )
        if (volunteer && emailService) {
          await emailService.sendTaskAssignmentEmail(volunteer, task)
        }
      } catch (emailErr) {
        console.error('⚠️ Assignment email failed:', emailErr.message)
      }
    }

    const acceptedCount = task.assignedVolunteers.filter(
      (v) => v.status === 'accepted'
    ).length
    task.status =
      acceptedCount >= task.volunteersNeeded ? 'in-progress' : 'open'
    await task.save()

    res
      .status(200)
      .json({ success: true, message: 'Volunteers assigned', data: task })
  } catch (error) {
    console.error('❌ Error:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error', error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════
// Update task duration
// ═══════════════════════════════════════════════════════════
exports.updateTaskDuration = async (req, res) => {
  try {
    const { taskId } = req.params
    const { duration } = req.body

    if (!duration || duration < 1) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid duration' })
    }

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    task.duration = duration
    task.endDate = new Date(task.startDate)
    task.endDate.setDate(task.endDate.getDate() + duration)

    for (const assignment of task.assignedVolunteers) {
      if (assignment.status === 'accepted') {
        const profile = await VolunteerProfile.findOne({
          userId: assignment.volunteerId,
        })
        if (profile) {
          profile.busyUntil = task.endDate
          await profile.save()
        }
      }
    }

    await task.save()

    res
      .status(200)
      .json({ success: true, message: 'Duration updated', data: task })
  } catch (error) {
    console.error('❌ Error:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error', error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════
// Complete task
// ═══════════════════════════════════════════════════════════
exports.completeTask = async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user._id
    const { rating, feedback } = req.body

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    const volunteerAssignment = task.assignedVolunteers.find(
      (v) => v.volunteerId.toString() === userId.toString()
    )

    if (!volunteerAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Not assigned to this task' })
    }

    volunteerAssignment.status = 'completed'
    volunteerAssignment.completedAt = new Date()
    if (rating) volunteerAssignment.rating = rating
    if (feedback) volunteerAssignment.feedback = feedback

    const allCompleted = task.assignedVolunteers.every(
      (v) => v.status === 'completed' || v.status === 'rejected'
    )
    if (allCompleted) task.status = 'completed'

    const profile = await VolunteerProfile.findOne({ userId })
    if (profile) {
      profile.availabilityStatus = 'FREE'
      profile.currentTaskId = null
      profile.busyUntil = null
      profile.tasksCompleted += 1
      await profile.save()
    }

    await task.save()

    res
      .status(200)
      .json({ success: true, message: 'Task completed', data: task })
  } catch (error) {
    console.error('❌ Error:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error', error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════
// Get task details
// ═══════════════════════════════════════════════════════════
exports.getTaskDetails = async (req, res) => {
  try {
    const { taskId } = req.params

    const task = await Task.findById(taskId)
      .populate('reportId')
      .populate('ngoId')
      .populate('assignedVolunteers.volunteerId', 'fullName email')

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' })
    }

    res.status(200).json({ success: true, data: task })
  } catch (error) {
    console.error('❌ Error:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error', error: error.message })
  }
}