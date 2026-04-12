const express = require('express')
const router = express.Router()
const controller = require('../controllers/volunteer.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

// Dashboard
router.get('/dashboard',
  restrictTo('volunteer'),
  controller.getDashboardData
)

// Tasks
router.get('/tasks',
  restrictTo('volunteer'),
  controller.getAvailableTasks
)

// NGO
router.post('/apply-ngo',
  restrictTo('volunteer'),
  controller.applyToNGO
)

router.get('/my-ngos',
  restrictTo('volunteer'),
  controller.getMyNGOs
)

// ✅ NEW: Profile update
router.put('/profile',
  restrictTo('volunteer'),
  controller.updateProfile
)

// ✅ NEW: Update location (live location)
router.put('/location',
  restrictTo('volunteer'),
  controller.updateLocation
)

module.exports = router