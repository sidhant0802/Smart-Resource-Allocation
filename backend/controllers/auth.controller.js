const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const NGO  = require('../models/NGO')
const Role = require('../models/Role')

// ── Generate JWT ─────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// ── Build user response ──────────────────────────────────────
const buildUserResponse = (user) => ({
  id:              user._id,
  email:           user.email,
  fullName:        user.fullName,
  phone:           user.phone,
  role:            user.roleName,
  status:          user.status,
  ngo:             user.ngo,
  zone:            user.zone,
  locationName:    user.locationName,
  operatingRadius: user.operatingRadius,
  coordinates: user.location?.coordinates
    ? {
        lng: user.location.coordinates[0],
        lat: user.location.coordinates[1],
      }
    : null,
  volunteerProfile: user.roleName === 'volunteer'
    ? user.volunteerProfile
    : undefined,
  createdAt: user.createdAt,
})


// ════════════════════════════════════════════════════════════
// SIGNUP
// ════════════════════════════════════════════════════════════
exports.signup = async (req, res) => {
  try {
    const {
      role,
      fullName,
      email,
      password,
      phone,
      latitude,
      longitude,
      locationName,
      operatingRadius,
      // NGO Manager
      ngoName,
      ngoDescription,
      ngoWebsite,
      // Committee / Staff
      ngoId,
      // Volunteer
      skills,
      taskPreferences,
      availableDays,
      availableTime,
    } = req.body

    // ── Validate required fields ──
    if (!role || !fullName || !email || !password) {
      return res.status(400).json({
        error: 'Role, name, email and password are required',
      })
    }

    // ── Check email exists ──
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    })
    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered',
      })
    }

    // ── Validate role ──
    const validRoles = [
      'ngo_manager',
      'committee_member',
      'ngo_staff',
      'volunteer',
    ]
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // ── Get Role document ──
    const roleDoc = await Role.findOne({ name: role })
    if (!roleDoc) {
      return res.status(400).json({
        error: 'Role not found. Please run seed first.',
      })
    }

    // ── Build location ──
    const locationData = {
      type:        'Point',
      coordinates: [
        parseFloat(longitude) || 0,
        parseFloat(latitude)  || 0,
      ],
    }

    let ngoRef     = ngoId   || undefined
    let createdNgo = null

    // ── NGO Manager → create NGO first ──
    if (role === 'ngo_manager') {
      if (!ngoName) {
        return res.status(400).json({
          error: 'NGO name is required',
        })
      }

      createdNgo = await NGO.create({
        name:         ngoName,
        description:  ngoDescription || '',
        website:      ngoWebsite     || '',
        contactEmail: email.toLowerCase(),
        status:       'pending',
        location: {
          type:        'Point',
          coordinates: [
            parseFloat(longitude) || 0,
            parseFloat(latitude)  || 0,
          ],
        },
        locationName: locationName || '',
      })

      ngoRef = createdNgo._id
    }

    // ── Build user object ──
    const userData = {
      email:           email.toLowerCase(),
      password,
      fullName,
      phone:           phone           || '',
      role:            roleDoc._id,
      roleName:        role,
      ngo:             ngoRef,
      location:        locationData,
      locationName:    locationName    || '',
      operatingRadius: operatingRadius || 10,
      status:          'pending',
    }

    // ── Role specific data ──
    if (role === 'ngo_manager') {
      userData.ngoManagerProfile = {
        ngoName,
        ngoDescription: ngoDescription || '',
        ngoWebsite:     ngoWebsite     || '',
      }
    }

    if (role === 'volunteer') {
      userData.volunteerProfile = {
        skills:          skills          || [],
        taskPreferences: taskPreferences || [],
        availableDays:   availableDays   || [],
        availableTime:   availableTime   || 'anytime',
      }
    }

    if (role === 'ngo_staff') {
      userData.staffProfile = {
        designation: '',
      }
    }

    if (role === 'committee_member') {
      userData.committeeProfile = {}
    }

    // ── Create user ──
    const newUser = await User.create(userData)

    // ── Link NGO to manager ──
    if (role === 'ngo_manager' && createdNgo) {
      await NGO.findByIdAndUpdate(createdNgo._id, {
        managedBy: newUser._id,
      })
    }

    res.status(201).json({
      success: true,
      message: role === 'ngo_manager'
        ? 'Account created! Your NGO is pending Super Admin approval.'
        : 'Account created! Waiting for approval.',
      user: buildUserResponse(newUser),
    })

  } catch (error) {
    console.error('Signup error:', error)

    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Email already registered',
      })
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({
        error: messages.join(', '),
      })
    }

    res.status(500).json({
      error: 'Server error during signup',
    })
  }
}


// ════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      })
    }

    // ── Find user with password ──
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('role', 'name displayName')
      .populate('ngo',  'name status')
      .populate('zone', 'name')

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      })
    }

    // ── Check password ──
    const isValid = await user.comparePassword(password)
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password',
      })
    }

    // ── Check status ──
    if (user.status === 'pending') {
      return res.status(403).json({
        error:   'PENDING',
        message: 'Your account is pending approval.',
      })
    }
    if (user.status === 'suspended') {
      return res.status(403).json({
        error:   'SUSPENDED',
        message: 'Account suspended. Contact support.',
      })
    }
    if (user.status === 'inactive') {
      return res.status(403).json({
        error:   'INACTIVE',
        message: 'Account is inactive.',
      })
    }

    // ── Generate token ──
    const token = generateToken(user._id)

    // ── Update last login ──
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
    })

    res.json({
      success: true,
      token,
      user:    buildUserResponse(user),
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Server error during login',
    })
  }
}


// ════════════════════════════════════════════════════════════
// GET ME (protected)
// ════════════════════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('role', 'name displayName')
      .populate('ngo',  'name status')
      .populate('zone', 'name')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      success: true,
      user:    buildUserResponse(user),
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
}


// ════════════════════════════════════════════════════════════
// GET APPROVED NGOs
// ════════════════════════════════════════════════════════════
exports.getApprovedNgos = async (req, res) => {
  try {
    const ngos = await NGO.find({ status: 'approved' })
      .select('name description')
      .sort('name')

    res.json({
      success: true,
      count:   ngos.length,
      ngos,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch NGOs' })
  }
}