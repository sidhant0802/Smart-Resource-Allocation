const express = require('express')
const router = express.Router()
const controller = require('../controllers/ngoManager')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('ngo_manager'))

// Dashboard
router.get('/dashboard', controller.getDashboard)

// Zones
router.post('/zones', controller.createZone)
router.delete('/zones/:zoneId', controller.deleteZone)

// Approvals - Committee & Staff
router.post('/approve-committee', controller.approveCommittee)
router.post('/approve-staff', controller.approveStaff)
router.delete('/decline/:memberId', controller.declineUser)

// ✅ Volunteer approval
router.patch('/volunteer-applications/:applicationId/review', controller.approveVolunteer)

// Reports
router.get('/reports/stats', controller.getReportStats)
router.get('/reports', controller.getNgoReports)
router.put('/reports/:reportId/review', controller.reviewReport)
router.delete('/reports/:reportId', controller.deleteReport)

module.exports = router