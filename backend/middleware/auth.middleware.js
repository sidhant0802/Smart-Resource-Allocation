const jwt  = require('jsonwebtoken')
const User = require('../models/User')

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token. Please login.' })
    }

    const token   = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id)
      .populate('role', 'name')
      .populate('ngo',  'name status')

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // ✅ Only block suspended users
    if (user.status === 'suspended') {
      return res.status(401).json({ error: 'Account suspended' })
    }

    req.user = user
    next()

  } catch (error) {
    if (error.name === 'JsonWebTokenError')  return res.status(401).json({ error: 'Invalid token' })
    if (error.name === 'TokenExpiredError')  return res.status(401).json({ error: 'Token expired' })
    res.status(500).json({ error: 'Auth error' })
  }
}

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({
        error: `Access denied. Required: ${roles.join(' or ')}`,
      })
    }
    next()
  }
}