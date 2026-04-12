const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/upload')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('ngo_staff'))

// Upload & process
router.post('/', controller.uploadMiddleware, controller.uploadAndProcess)

// Report status
router.get('/status/:reportId', controller.getReportStatus)

// Nearby NGOs
router.get('/nearby-ngos', controller.getNearbyNgos)

// NGO zones
router.get('/ngo/:ngoId/zones', controller.getNgoZones)

// Staff profile
router.get('/profile', controller.getStaffProfile)

// Apply to NGO
router.post('/apply-ngo', controller.applyToNgo)

// My NGO applications
router.get('/my-applications', controller.getMyNgoApplications)

module.exports = router