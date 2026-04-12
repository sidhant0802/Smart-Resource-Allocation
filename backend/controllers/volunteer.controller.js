const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const Task = require('../models/Task')
const User = require('../models/User')

// ═══════════════════════════════════════════════════════════
// Get volunteer dashboard data
// ═══════════════════════════════════════════════════════════
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id

    console.log('📊 Fetching dashboard for user:', userId)

    const user = await User.findById(userId)
      .select('fullName email location locationName volunteerProfile phone')

    let profile = await VolunteerProfile.findOne({ userId })
      .select('availabilityStatus currentTaskId busyUntil skills interests bio phoneNumber rating tasksCompleted peopleHelped location locationName maxDistance')

    if (!profile) {
      console.log('⚠️ No volunteer profile found, creating default...')
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

    // Fetch current active task
    let currentTask = null
    if (profile.currentTaskId) {
      currentTask = await Task.findById(profile.currentTaskId)
        .populate('ngoId', 'name')
        .select('title description category location locationName startDate endDate duration assignedVolunteers')
        .lean()

      if (currentTask) {
        currentTask.ngo = currentTask.ngoId || { name: 'Unknown NGO' }
        delete currentTask.ngoId
      }
    }

    // Fetch applied NGOs
    const appliedNGOs = await VolunteerApplication.find({ volunteerId: userId })
      .populate('ngoId', 'name')
      .select('ngoId status')

    // Fetch available tasks
    let availableTasks = []
    if (profile.availabilityStatus === 'FREE') {
      availableTasks = await Task.find({
        status: 'open'
      })
        .populate('ngoId', 'name')
        .select('title description category location locationName volunteersNeeded assignedVolunteers startDate endDate duration urgencyScore skillsRequired')
        .limit(20)
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
    }

    // Fetch completed tasks
    const completedTasks = await Task.find({
      'assignedVolunteers.volunteerId': userId,
      'assignedVolunteers.status': 'completed'
    })
      .populate('ngoId', 'name')
      .select('title description category location locationName startDate endDate duration urgencyScore assignedVolunteers')
      .sort({ updatedAt: -1 })
      .lean()

    const formattedCompletedTasks = completedTasks.map(task => {
      const volunteerData = task.assignedVolunteers.find(
        v => v.volunteerId.toString() === userId.toString()
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

    // Fetch pending applications (tasks volunteer applied to, awaiting approval)
    const pendingTasks = await Task.find({
      'assignedVolunteers.volunteerId': userId,
      'assignedVolunteers.status': 'pending_approval',
      status: 'open'
    })
      .populate('ngoId', 'name')
      .select('title description category locationName startDate duration urgencyScore')
      .lean()

    const formattedPendingTasks = pendingTasks.map(task => ({
      ...task,
      ngo: task.ngoId || { name: 'Unknown NGO' },
      ngoId: undefined
    }))

    console.log('✅ Dashboard data fetched successfully')
    console.log(`   Available: ${availableTasks.length}, Completed: ${formattedCompletedTasks.length}, Pending: ${formattedPendingTasks.length}`)

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
          maxDistance: profile.maxDistance
        },
        appliedNGOs: appliedNGOs.map(app => ({
          _id: app.ngoId?._id,
          name: app.ngoId?.name || 'Unknown NGO',
          status: app.status
        })),
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
    console.error('❌ Error fetching dashboard data:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Update volunteer profile
// ═══════════════════════════════════════════════════════════
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id
    const { fullName, phoneNumber, bio, skills, interests, maxDistance } = req.body

    console.log('📝 Updating profile for user:', userId)

    // Update User model
    const userUpdate = {}
    if (fullName) userUpdate.fullName = fullName
    if (phoneNumber) userUpdate.phone = phoneNumber

    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(userId, userUpdate)
    }

    // Update VolunteerProfile
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

    // ✅ FIX: Get fresh user and return SAME format as login/getMe
    const updatedUser = await User.findById(userId)
      .populate('role', 'name displayName')
      .populate('ngo', 'name status')
      .populate('zone', 'name')

    // ✅ FIX: Use same response format as auth controller
    const userResponse = {
      id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      role: updatedUser.roleName,          // ✅ String, not ObjectId
      status: updatedUser.status,
      ngo: updatedUser.ngo,
      zone: updatedUser.zone,
      locationName: updatedUser.locationName,
      operatingRadius: updatedUser.operatingRadius,
      coordinates: updatedUser.location?.coordinates
        ? {
            lng: updatedUser.location.coordinates[0],
            lat: updatedUser.location.coordinates[1],
          }
        : null,
      location: updatedUser.location,      // ✅ Include raw location too
      volunteerProfile: updatedUser.volunteerProfile,
      createdAt: updatedUser.createdAt,
    }

    console.log('✅ Profile updated successfully')

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userResponse,                // ✅ Same format as login
        profile
      }
    })
  } catch (error) {
    console.error('❌ Error updating profile:', error)
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    })
  }
}
// ═══════════════════════════════════════════════════════════
// Apply to NGO
// ═══════════════════════════════════════════════════════════
exports.applyToNGO = async (req, res) => {
  try {
    const { ngoId } = req.body
    const userId = req.user._id

    if (!ngoId) {
      return res.status(400).json({
        success: false,
        message: 'NGO ID is required'
      })
    }

    const existingApp = await VolunteerApplication.findOne({ volunteerId: userId, ngoId })
    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'Already applied to this NGO'
      })
    }

    const application = await VolunteerApplication.create({
      volunteerId: userId,
      ngoId,
      status: 'pending'
    })

    res.status(201).json({
      success: true,
      message: 'Application submitted',
      data: application
    })
  } catch (error) {
    console.error('Error applying to NGO:', error)
    res.status(500).json({
      success: false,
      message: 'Error applying to NGO',
      error: error.message
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Get volunteer's NGOs
// ═══════════════════════════════════════════════════════════
exports.getMyNGOs = async (req, res) => {
  try {
    const userId = req.user._id

    const ngos = await VolunteerApplication.find({ volunteerId: userId })
      .populate('ngoId', 'name email description')
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: ngos
    })
  } catch (error) {
    console.error('Error fetching NGOs:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching NGOs',
      error: error.message
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Get available tasks
// ═══════════════════════════════════════════════════════════
exports.getAvailableTasks = async (req, res) => {
  try {
    const userId = req.user._id
    const { category, distance, sort } = req.query

    const profile = await VolunteerProfile.findOne({ userId })

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer profile not found'
      })
    }

    if (profile.availabilityStatus !== 'FREE') {
      return res.status(400).json({
        success: false,
        message: 'Cannot fetch tasks while BUSY or PENDING',
        currentStatus: profile.availabilityStatus
      })
    }

    let query = Task.find({
      status: 'open'
    })

    if (category) {
      query = query.where('category').equals(category)
    }

    let tasks = await query
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

    if (distance) {
      tasks = tasks.filter(t => t.distance <= distance)
    } else {
      tasks = tasks.filter(t => t.distance <= (profile.maxDistance || 50))
    }

    if (sort === 'urgent') {
      tasks.sort((a, b) => b.urgencyScore - a.urgencyScore)
    } else if (sort === 'nearest') {
      tasks.sort((a, b) => a.distance - b.distance)
    } else {
      tasks.sort((a, b) => b.urgencyScore - a.urgencyScore)
    }

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    })
  }
}
// ... everything above stays the same ...

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

// ═══════════════════════════════════════════════════════════
// Update volunteer location (live location)
// ═══════════════════════════════════════════════════════════
exports.updateLocation = async (req, res) => {
  try {
    const userId = req.user._id
    const { coordinates, locationName } = req.body

    console.log('📍 Updating location for user:', userId)

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Must be [longitude, latitude]'
      })
    }

    const [longitude, latitude] = coordinates

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of range'
      })
    }

    const location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    }

    // Update User model
    await User.findByIdAndUpdate(userId, {
      location,
      locationName: locationName || ''
    })

    // Update VolunteerProfile
    await VolunteerProfile.findOneAndUpdate(
      { userId },
      { location, locationName: locationName || '' },
      { upsert: true }
    )

    // Return same format as login/getMe
    const updatedUser = await User.findById(userId)
      .populate('role', 'name displayName')
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
      operatingRadius: updatedUser.operatingRadius,
      coordinates: updatedUser.location?.coordinates
        ? {
            lng: updatedUser.location.coordinates[0],
            lat: updatedUser.location.coordinates[1],
          }
        : null,
      volunteerProfile: updatedUser.volunteerProfile,
      createdAt: updatedUser.createdAt,
    }

    console.log('✅ Location updated:', locationName || coordinates)

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        user: userResponse,
        location,
        locationName
      }
    })
  } catch (error) {
    console.error('❌ Error updating location:', error)
    res.status(500).json({
      success: false,
      message: 'Error updating location',
      error: error.message
    })
  }
}

module.exports = {
  getDashboardData: exports.getDashboardData,
  getAvailableTasks: exports.getAvailableTasks,
  applyToNGO: exports.applyToNGO,
  getMyNGOs: exports.getMyNGOs,
  updateProfile: exports.updateProfile,
  updateLocation: exports.updateLocation
}