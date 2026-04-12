const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

// Public routes
router.post('/register',      controller.register)
router.post('/login',         controller.login)
router.get('/approved-ngos',  controller.getApprovedNgos)

// Protected
router.get('/me', protect, controller.getMe)

module.exports = router