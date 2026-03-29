const jwt  = require('jsonwebtoken')
const User = require('../models/User')

// ── Protect routes (must be logged in) ──────────────────────
exports.protect = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token. Please login.' })
    }

    const token = authHeader.split(' ')[1]

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Find user
    const user = await User.findById(decoded.id)
      .populate('role', 'name')
      .populate('ngo',  'name status')

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' })
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active' })
    }

    req.user = user
    next()

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Login again.' })
    }
    res.status(500).json({ error: 'Auth middleware error' })
  }
}

// ── Restrict to specific roles ───────────────────────────────
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      })
    }
    next()
  }
}