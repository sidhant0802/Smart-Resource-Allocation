const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

// Public routes
router.post('/signup',       controller.signup)
router.post('/login',        controller.login)
router.get('/ngos/approved', controller.getApprovedNgos)

// Protected routes
router.get('/me', protect, controller.getMe)

module.exports = router