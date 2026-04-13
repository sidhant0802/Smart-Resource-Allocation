const User = require('../models/User')
const Role = require('../models/Role')
const NGO  = require('../models/NGO')
const Zone = require('../models/Zone')
const jwt  = require('jsonwebtoken')

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

// ══════════════════════════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════════════════════════
exports.register = async (req, res) => {
  try {
    const {
      role, fullName, email, password, phone,
      latitude, longitude, locationName, operatingRadius,
      // NGO Manager fields
      ngoName, ngoDescription, ngoWebsite,
      // Committee / Staff fields
      ngoId,
      // Volunteer fields
      skills, taskPreferences, availableDays, availableTime,
    } = req.body

    // ── 1. Check email uniqueness ─────────────────────────────
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    })
    if (existingUser) {
      return res.status(400).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists. Please login.',
      })
    }

    // ── 2. Validate role ─────────────────────────────────────
    const allowedRoles = [
      'ngo_manager',
      'committee_member',
      'ngo_staff',
      'volunteer',
    ]
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // ── 3. Get Role document ──────────────────────────────────
    const roleDoc = await Role.findOne({ name: role })
    if (!roleDoc) {
      return res.status(400).json({ error: `Role '${role}' not found in DB` })
    }

    // ── 4. Build location ────────────────────────────────────
    const location = {
      type: 'Point',
      coordinates: [
        parseFloat(longitude) || 0,
        parseFloat(latitude)  || 0,
      ],
    }

    // ── 5. Build user data ────────────────────────────────────
    const userData = {
      email:     email.toLowerCase().trim(),
      password,
      fullName:  fullName.trim(),
      phone:     phone?.trim() || '',
      role:      roleDoc._id,
      roleName:  role,
      location,
      locationName:    locationName    || '',
      operatingRadius: operatingRadius || 10,
      // ✅ Role-based status
status: (role === 'committee_member' || role === 'ngo_staff') ? 'pending' : 'active',
    }

    // ── 6. Role-specific data ─────────────────────────────────

    // NGO MANAGER → create NGO (pending super admin approval)
    if (role === 'ngo_manager') {
      if (!ngoName?.trim()) {
        return res.status(400).json({ error: 'NGO name is required' })
      }

      const ngo = await NGO.create({
        name:         ngoName.trim(),
        description:  ngoDescription || '',
        website:      ngoWebsite     || '',
        location,
        locationName: locationName   || '',
        status:       'pending',    // NGO needs super admin approval
      })

      userData.ngo = ngo._id
      userData.ngoManagerProfile = {
        ngoName:        ngoName,
        ngoDescription: ngoDescription || '',
        ngoWebsite:     ngoWebsite     || '',
      }
    }

    // COMMITTEE MEMBER → link to NGO (needs manager approval to work)
    if (role === 'committee_member') {
      if (ngoId) {
        const ngo = await NGO.findById(ngoId)
        if (!ngo || ngo.status !== 'approved') {
          return res.status(400).json({
            error: 'Selected NGO is not approved',
          })
        }
        userData.ngo = ngoId
        // ✅ Account is active, but they need zone assignment to work
        // committeeProfile will be set when manager assigns them
      }
    }

    // NGO STAFF → link to NGO
    if (role === 'ngo_staff') {
      if (ngoId) {
        const ngo = await NGO.findById(ngoId)
        if (!ngo || ngo.status !== 'approved') {
          return res.status(400).json({
            error: 'Selected NGO is not approved',
          })
        }
        userData.ngo = ngoId
        // ✅ Account active, needs zone assignment to submit reports
      }
    }

    // VOLUNTEER → save skills & preferences
    if (role === 'volunteer') {
      userData.volunteerProfile = {
        skills:          skills          || [],
        taskPreferences: taskPreferences || [],
        availableDays:   availableDays   || [],
        availableTime:   availableTime   || '',
        tasksCompleted:  0,
        hoursVolunteered: 0,
        peopleHelped:    0,
        rating:          0,
      }

      // ✅ Volunteer is active immediately
      // They can browse tasks and apply
      // Approval only when applying to specific NGO/task
    }

    // ── 7. Create user ────────────────────────────────────────
    const user = await User.create(userData)

    // ── 8. For NGO Manager: update NGO with managedBy ────────
    if (role === 'ngo_manager' && user.ngo) {
      await NGO.findByIdAndUpdate(user.ngo, {
        managedBy: user._id,
      })
    }

    // ── 9. Create volunteer profile document ─────────────────
    if (role === 'volunteer') {
      const VolunteerProfile = require('../models/VolunteerProfile')
      await VolunteerProfile.create({
        userId:       user._id,
        location,
        locationName: locationName || '',
        skills:       skills       || [],
        interests:    taskPreferences || [],
        availabilityStatus: 'FREE',
        bio:          '',
        phoneNumber:  phone || '',
      })
    }

    // ── 10. Generate token ────────────────────────────────────
    const token = generateToken(user._id)

    // ── 11. Build response ────────────────────────────────────
    const userResponse = {
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
      coordinates: location.coordinates[0] !== 0
        ? { lng: location.coordinates[0], lat: location.coordinates[1] }
        : null,
      volunteerProfile: user.volunteerProfile,
      createdAt:        user.createdAt,
    }

    // ── 12. Determine message ─────────────────────────────────
    let message = 'Account created successfully!'
    if (role === 'ngo_manager') {
      message = 'Account created! Your NGO is pending Super Admin approval. You can login but full features unlock after approval.'
    } else if (role === 'committee_member' || role === 'ngo_staff') {
      message = ngoId
        ? 'Account created! You can login now. Your zone will be assigned by the NGO Manager.'
        : 'Account created! You can login now.'
    } else if (role === 'volunteer') {
      message = 'Account created! You can login and start applying for tasks right away.'
    }

    res.status(201).json({
      success: true,
      message,
      token,
      user: userResponse,
    })

  } catch (error) {
    console.error('❌ Register error:', error)

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists.',
      })
    }

    res.status(500).json({
      error: 'Registration failed',
      message: error.message,
    })
  }
}

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('role',  'name displayName')
      .populate('ngo',   'name status')
      .populate('zone',  'name')

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // ✅ Only check for suspended - active users can always login
    if (user.status === 'suspended') {
  return res.status(401).json({ error: 'SUSPENDED' })
}

// ✅ Add this
if (user.status === 'pending') {
  return res.status(401).json({ error: 'PENDING' })
}

    // Update last login
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    const token = generateToken(user._id)

    const userResponse = {
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
      coordinates: user.location?.coordinates?.[0] !== 0
        ? {
            lng: user.location.coordinates[0],
            lat: user.location.coordinates[1],
          }
        : null,
      location:         user.location,
      volunteerProfile: user.volunteerProfile,
      approvedNgos:     user.approvedNgos,
      createdAt:        user.createdAt,
    }

    res.json({
      success: true,
      token,
      user: userResponse,
    })

  } catch (error) {
    console.error('❌ Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET ME
// ══════════════════════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('role',  'name displayName')
      .populate('ngo',   'name status')
      .populate('zone',  'name')
      .select('-password')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userResponse = {
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
      coordinates: user.location?.coordinates?.[0] !== 0
        ? {
            lng: user.location.coordinates[0],
            lat: user.location.coordinates[1],
          }
        : null,
      location:         user.location,
      volunteerProfile: user.volunteerProfile,
      approvedNgos:     user.approvedNgos,
      createdAt:        user.createdAt,
    }

    res.json({ success: true, user: userResponse })

  } catch (error) {
    console.error('❌ GetMe error:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}

// ══════════════════════════════════════════════════════════════
// GET APPROVED NGOs (for signup dropdown)
// ══════════════════════════════════════════════════════════════
exports.getApprovedNgos = async (req, res) => {
  try {
    const ngos = await NGO.find({ status: 'approved' })
      .select('name description locationName location')
      .sort({ name: 1 })

    res.json({ success: true, ngos })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch NGOs' })
  }
}