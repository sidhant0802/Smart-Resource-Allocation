const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const WorkerAssignment = require('../models/WorkerAssignment')
const Task = require('../models/Task')
const User = require('../models/User')
const NGO = require('../models/NGO')

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────
function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2) return 0
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return parseFloat((R * c).toFixed(1))
}

// ─────────────────────────────────────────────────────────────
// GET DASHBOARD DATA
// ─────────────────────────────────────────────────────────────
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id

    const user = await User.findById(userId)
      .select('fullName email location locationName volunteerProfile phone approvedNgos ngo')
      .populate('approvedNgos.ngoId', 'name')

    let profile = await VolunteerProfile.findOne({ userId })

    if (!profile) {
      profile = await VolunteerProfile.create({
        userId,
        location: user?.location || { type: 'Point', coordinates: [77.2090, 28.6139] },
        locationName: user?.locationName || 'New Delhi',
        availabilityStatus: 'FREE',
        skills: user?.volunteerProfile?.skills || [],
        interests: [],
        bio: '',
        phoneNumber: user?.phone || '',
        tasksCompleted: 0,
        peopleHelped: 0,
        rating: 0
      })
    }

    // Current active task
    let currentTask = null
    if (profile.currentTaskId) {
      currentTask = await Task.findById(profile.currentTaskId)
        .populate('ngoId', 'name')
        .select('title description category location locationName startDate endDate duration assignedVolunteers skillsRequired')
        .lean()

      if (currentTask) {
        currentTask.ngo = currentTask.ngoId || { name: 'Unknown NGO' }
        delete currentTask.ngoId
      }
    }

    // ✅ Get approved NGO IDs for this volunteer
    const approvedNgoApps = await VolunteerApplication.find({
      volunteerId: userId,
      status: 'approved'
    }).select('ngoId')

    const approvedNgoIds = approvedNgoApps.map(app => app.ngoId)

    // Also include primary NGO if exists
    if (user.ngo && !approvedNgoIds.find(id => id.toString() === user.ngo.toString())) {
      approvedNgoIds.push(user.ngo)
    }

    // Also from user.approvedNgos array
    if (user.approvedNgos?.length > 0) {
      user.approvedNgos.forEach(a => {
        const ngoId = a.ngoId?._id || a.ngoId
        if (ngoId && !approvedNgoIds.find(id => id.toString() === ngoId.toString())) {
          approvedNgoIds.push(ngoId)
        }
      })
    }

    console.log(`✅ Volunteer ${userId} approved NGOs: ${approvedNgoIds.length}`)

    // ✅ Available tasks - ONLY from approved NGOs
    let availableTasks = []
    if (profile.availabilityStatus === 'FREE' && approvedNgoIds.length > 0) {
      availableTasks = await Task.find({
        status: 'open',
        ngoId: { $in: approvedNgoIds } // ✅ Only from approved NGOs
      })
        .populate('ngoId', 'name')
        .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired ngoId')
        .limit(30)
        .lean()

      availableTasks = availableTasks.map(task => {
        const distance = profile.location?.coordinates
          ? calculateDistance(profile.location.coordinates, task.location?.coordinates || [0, 0])
          : 0

        return {
          ...task,
          ngo: task.ngoId || { name: 'Unknown NGO' },
          ngoId: undefined,
          distance,
          volunteersAssigned: Array.isArray(task.assignedVolunteers)
            ? task.assignedVolunteers.filter(v => v.status === 'accepted').length
            : 0
        }
      })

      // Sort by urgency
      availableTasks.sort((a, b) => b.urgencyScore - a.urgencyScore)
    }

    // Volunteer applications (NGOs)
    const appliedNGOs = await VolunteerApplication.find({ volunteerId: userId })
      .populate('ngoId', 'name')
      .select('ngoId status')

    // Completed tasks
    const completedTasks = await Task.find({
      'assignedVolunteers.volunteerId': userId,
      'assignedVolunteers.status': 'completed'
    })
      .populate('ngoId', 'name')
      .select('title description category location locationName startDate endDate duration urgencyScore assignedVolunteers')
      .sort({ updatedAt: -1 })
      .lean()

    const formattedCompletedTasks = completedTasks.map(task => {
      const volunteerData = task.assignedVolunteers?.find(
        v => v.volunteerId?.toString() === userId.toString()
      )
      return {
        ...task,
        ngo: task.ngoId || { name: 'Unknown NGO' },
        ngoId: undefined,
        rating: volunteerData?.rating || 0,
        feedback: volunteerData?.feedback || '',
        completedAt: volunteerData?.completedAt,
        status: 'completed'
      }
    })

    // Pending task applications
    const pendingTasks = await Task.find({
      'assignedVolunteers.volunteerId': userId,
      'assignedVolunteers.status': 'pending_approval',
      status: { $in: ['open', 'in-progress'] }
    })
      .populate('ngoId', 'name')
      .select('title description category locationName startDate duration urgencyScore assignedVolunteers')
      .lean()

    const formattedPendingTasks = pendingTasks.map(task => ({
      ...task,
      ngo: task.ngoId || { name: 'Unknown NGO' },
      ngoId: undefined
    }))

    res.status(200).json({
      success: true,
      data: {
        currentTask,
        availabilityStatus: profile.availabilityStatus,
        busyUntil: profile.busyUntil,
        profile: {
          bio: profile.bio,
          phoneNumber: profile.phoneNumber,
          skills: profile.skills,
          interests: profile.interests,
          location: profile.location,
          locationName: profile.locationName,
          maxDistance: profile.maxDistance,
          rating: profile.rating
        },
        appliedNGOs: appliedNGOs.map(app => ({
          _id: app.ngoId?._id,
          name: app.ngoId?.name || 'Unknown NGO',
          status: app.status
        })),
        approvedNgoCount: approvedNgoIds.length, // ✅ NEW
        availableTasks,
        completedTasks: formattedCompletedTasks,
        pendingTasks: formattedPendingTasks,
        stats: {
          tasksCompleted: profile.tasksCompleted,
          peopleHelped: profile.peopleHelped,
          rating: profile.rating,
          skills: profile.skills
        }
      }
    })
  } catch (error) {
    console.error('❌ Dashboard error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY TO TASK
// ─────────────────────────────────────────────────────────────
exports.applyToTask = async (req, res) => {
  try {
    const userId = req.user._id
    const { taskId } = req.params

    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' })
    }

    if (task.status !== 'open') {
      return res.status(400).json({ success: false, error: 'Task is not open for applications' })
    }

    // ✅ Check volunteer is approved for this NGO
    const approvedApp = await VolunteerApplication.findOne({
      volunteerId: userId,
      ngoId: task.ngoId,
      status: 'approved'
    })

    // Also check user.approvedNgos
    const userDoc = await User.findById(userId).select('approvedNgos ngo')
    const inApprovedNgos = userDoc?.approvedNgos?.some(
      a => (a.ngoId?._id || a.ngoId)?.toString() === task.ngoId?.toString()
    )
    const isPrimaryNgo = userDoc?.ngo?.toString() === task.ngoId?.toString()

    if (!approvedApp && !inApprovedNgos && !isPrimaryNgo) {
      return res.status(403).json({
        success: false,
        error: 'You must be approved by this NGO before applying to their tasks'
      })
    }

    // ✅ Check if already applied
    const alreadyApplied = task.assignedVolunteers?.find(
      v => v.volunteerId?.toString() === userId.toString()
    )
    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        error: `Already applied to this task (status: ${alreadyApplied.status})`
      })
    }

    // ✅ Check quota
    const acceptedCount = task.assignedVolunteers?.filter(
      v => v.status === 'accepted' || v.status === 'approved'
    ).length || 0

    if (acceptedCount >= task.volunteersNeeded) {
      return res.status(400).json({
        success: false,
        error: 'This task has reached its volunteer quota'
      })
    }

    // Add volunteer
    task.assignedVolunteers.push({
      volunteerId: userId,
      status: 'pending_approval'
    })

    await task.save()

    res.status(200).json({
      success: true,
      message: 'Application submitted! Awaiting committee approval.',
      taskId,
      status: 'pending_approval'
    })
  } catch (error) {
    console.error('❌ Apply to task error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// GET APPLIED TASK IDs
// ─────────────────────────────────────────────────────────────
exports.getAppliedTaskIds = async (req, res) => {
  try {
    const userId = req.user._id

    const tasks = await Task.find({
      'assignedVolunteers.volunteerId': userId
    }).select('_id')

    res.json({ success: true, taskIds: tasks.map(t => t._id.toString()) })
  } catch (error) {
    console.error('❌ Get applied task IDs error:', error)
    res.status(500).json({ success: false, taskIds: [] })
  }
}

// ─────────────────────────────────────────────────────────────
// GET MY ASSIGNMENTS (from WorkerAssignment)
// ─────────────────────────────────────────────────────────────
exports.getMyAssignments = async (req, res) => {
  try {
    const userId = req.user._id

    const assignments = await WorkerAssignment.find({
      'slots.volunteerId': userId
    })
      .populate('taskId', 'title description category locationName startDate endDate duration')
      .populate('ngoId', 'name')
      .populate('reportId', 'title')
      .sort({ createdAt: -1 })
      .lean()

    const result = assignments.map(a => ({
      _id: a._id,
      task: a.taskId,
      ngo: a.ngoId,
      report: a.reportId,
      durationDays: a.durationDays,
      startDate: a.startDate,
      endDate: a.endDate,
      assignmentStatus: a.assignmentStatus,
      progress: (() => {
        const approved = a.slots.filter(s => s.status === 'approved').length
        return `${approved}/${a.totalSlotsNeeded}`
      })(),
      slots: a.slots
        .filter(s => s.volunteerId?.toString() === userId.toString())
        .map(s => ({
          slotNumber: s.slotNumber,
          status: s.status,
          assignmentEmailSentAt: s.assignmentEmailSentAt,
          approvalResponseAt: s.approvalResponseAt
        })),
      createdAt: a.createdAt
    }))

    res.json({ success: true, assignments: result })
  } catch (error) {
    console.error('❌ Get assignments error:', error)
    res.status(500).json({ success: false, assignments: [] })
  }
}

// ─────────────────────────────────────────────────────────────
// GET TASKS IN AREA (for NGO Staff)
// ─────────────────────────────────────────────────────────────
exports.getTasksInArea = async (req, res) => {
  try {
    const { latitude, longitude, radius = 30000 } = req.query

    let tasks = []

    if (latitude && longitude) {
      try {
        tasks = await Task.find({
          status: 'open',
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
              },
              $maxDistance: parseInt(radius)
            }
          }
        })
          .populate('ngoId', 'name locationName')
          .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired ngoId')
          .limit(30)
          .lean()
      } catch {
        // Fallback without geo
        tasks = await Task.find({ status: 'open' })
          .populate('ngoId', 'name locationName')
          .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired ngoId')
          .limit(30)
          .lean()
      }
    } else {
      tasks = await Task.find({ status: 'open' })
        .populate('ngoId', 'name locationName')
        .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired ngoId')
        .limit(30)
        .lean()
    }

    const formattedTasks = tasks.map(task => {
      const distance = (latitude && longitude && task.location?.coordinates)
        ? calculateDistance(
            [parseFloat(longitude), parseFloat(latitude)],
            task.location.coordinates
          )
        : null
      return { ...task, distance, assignedVolunteers: task.assignedVolunteers || [] }
    })

    res.json({ success: true, tasks: formattedTasks })
  } catch (error) {
    console.error('❌ Get tasks in area error:', error)
    res.status(500).json({ success: false, tasks: [] })
  }
}

// ─────────────────────────────────────────────────────────────
// GET MY TASK APPLICATIONS (for NGO Staff)
// ─────────────────────────────────────────────────────────────
exports.getMyTaskApplications = async (req, res) => {
  try {
    const userId = req.user._id
    const tasks = await Task.find({
      'assignedVolunteers.volunteerId': userId
    }).select('_id')

    res.json({ success: true, taskIds: tasks.map(t => t._id.toString()) })
  } catch (error) {
    console.error('❌ Get task applications error:', error)
    res.status(500).json({ success: false, taskIds: [] })
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id
    const { fullName, phoneNumber, bio, skills, interests, maxDistance } = req.body

    const userUpdate = {}
    if (fullName) userUpdate.fullName = fullName
    if (phoneNumber) userUpdate.phone = phoneNumber
    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(userId, userUpdate)
    }

    const profileUpdate = {}
    if (phoneNumber !== undefined) profileUpdate.phoneNumber = phoneNumber
    if (bio !== undefined) profileUpdate.bio = bio
    if (skills !== undefined) profileUpdate.skills = skills
    if (interests !== undefined) profileUpdate.interests = interests
    if (maxDistance !== undefined) profileUpdate.maxDistance = maxDistance

    const profile = await VolunteerProfile.findOneAndUpdate(
      { userId },
      profileUpdate,
      { new: true, upsert: true }
    )

    const updatedUser = await User.findById(userId)
      .populate('role', 'name')
      .populate('ngo', 'name status')
      .populate('zone', 'name')

    const userResponse = {
      id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      role: updatedUser.roleName,
      status: updatedUser.status,
      ngo: updatedUser.ngo,
      zone: updatedUser.zone,
      locationName: updatedUser.locationName,
      location: updatedUser.location,
      coordinates: updatedUser.location?.coordinates
        ? { lng: updatedUser.location.coordinates[0], lat: updatedUser.location.coordinates[1] }
        : null,
      volunteerProfile: updatedUser.volunteerProfile,
      approvedNgos: updatedUser.approvedNgos,
      createdAt: updatedUser.createdAt
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: userResponse, profile }
    })
  } catch (error) {
    console.error('❌ Update profile error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY TO NGO
// ─────────────────────────────────────────────────────────────
exports.applyToNGO = async (req, res) => {
  try {
    const { ngoId } = req.body
    const userId = req.user._id

    if (!ngoId) {
      return res.status(400).json({ success: false, message: 'NGO ID is required' })
    }

    const existingApp = await VolunteerApplication.findOne({ volunteerId: userId, ngoId })
    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: `Already ${existingApp.status} for this NGO`
      })
    }

    const application = await VolunteerApplication.create({
      volunteerId: userId,
      ngoId,
      status: 'pending'
    })

    res.status(201).json({
      success: true,
      message: 'Application submitted!',
      data: application
    })
  } catch (error) {
    console.error('❌ Apply to NGO error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// GET MY NGOs
// ─────────────────────────────────────────────────────────────
exports.getMyNGOs = async (req, res) => {
  try {
    const userId = req.user._id

    const ngos = await VolunteerApplication.find({ volunteerId: userId })
      .populate('ngoId', 'name email description locationName location')
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, data: ngos })
  } catch (error) {
    console.error('❌ Get my NGOs error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// GET AVAILABLE TASKS
// ─────────────────────────────────────────────────────────────
exports.getAvailableTasks = async (req, res) => {
  try {
    const userId = req.user._id
    const { category, sort } = req.query

    const profile = await VolunteerProfile.findOne({ userId })
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' })
    }

    // ✅ Get approved NGOs
    const approvedApps = await VolunteerApplication.find({
      volunteerId: userId,
      status: 'approved'
    }).select('ngoId')

    const approvedNgoIds = approvedApps.map(app => app.ngoId)

    if (approvedNgoIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'Apply to NGOs to see available tasks'
      })
    }

    // ✅ Only tasks from approved NGOs
    let query = { status: 'open', ngoId: { $in: approvedNgoIds } }
    if (category) query.category = category

    let tasks = await Task.find(query)
      .populate('ngoId', 'name')
      .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired')
      .lean()

    tasks = tasks.map(task => {
      const dist = profile.location?.coordinates
        ? calculateDistance(profile.location.coordinates, task.location?.coordinates || [0, 0])
        : 0
      return {
        ...task,
        ngo: task.ngoId || { name: 'Unknown NGO' },
        ngoId: undefined,
        distance: dist,
        volunteersAssigned: Array.isArray(task.assignedVolunteers)
          ? task.assignedVolunteers.filter(v => v.status === 'accepted').length
          : 0
      }
    })

    tasks = tasks.filter(t => t.distance <= (profile.maxDistance || 50))

    if (sort === 'nearest') {
      tasks.sort((a, b) => a.distance - b.distance)
    } else {
      tasks.sort((a, b) => b.urgencyScore - a.urgencyScore)
    }

    res.status(200).json({ success: true, count: tasks.length, data: tasks })
  } catch (error) {
    console.error('❌ Get tasks error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE LOCATION
// ─────────────────────────────────────────────────────────────
exports.updateLocation = async (req, res) => {
  try {
    const userId = req.user._id
    const { coordinates, locationName } = req.body

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates [lng, lat]' })
    }

    const location = { type: 'Point', coordinates }

    await User.findByIdAndUpdate(userId, { location, locationName: locationName || '' })
    await VolunteerProfile.findOneAndUpdate(
      { userId },
      { location, locationName: locationName || '' },
      { upsert: true }
    )

    const updatedUser = await User.findById(userId)
      .populate('role', 'name')
      .populate('ngo', 'name status')
      .populate('zone', 'name')

    const userResponse = {
      id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      role: updatedUser.roleName,
      status: updatedUser.status,
      ngo: updatedUser.ngo,
      zone: updatedUser.zone,
      locationName: updatedUser.locationName,
      location: updatedUser.location,
      coordinates: updatedUser.location?.coordinates
        ? { lng: updatedUser.location.coordinates[0], lat: updatedUser.location.coordinates[1] }
        : null,
      volunteerProfile: updatedUser.volunteerProfile,
      approvedNgos: updatedUser.approvedNgos,
      createdAt: updatedUser.createdAt
    }

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: { user: userResponse, location, locationName }
    })
  } catch (error) {
    console.error('❌ Update location error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

module.exports = {
  getDashboardData: exports.getDashboardData,
  getAvailableTasks: exports.getAvailableTasks,
  applyToTask: exports.applyToTask,
  getAppliedTaskIds: exports.getAppliedTaskIds,
  getMyAssignments: exports.getMyAssignments,
  getTasksInArea: exports.getTasksInArea,
  getMyTaskApplications: exports.getMyTaskApplications,
  applyToNGO: exports.applyToNGO,
  getMyNGOs: exports.getMyNGOs,
  updateProfile: exports.updateProfile,
  updateLocation: exports.updateLocation
}