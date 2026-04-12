const express = require('express')
const router = express.Router()
const controller = require('../controllers/report')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

// ── Staff routes ──
router.get('/my-reports', restrictTo('ngo_staff'), controller.getMyReports)
router.put('/:reportId/visibility', restrictTo('ngo_staff'), controller.updateVisibility)

// ── Committee-only routes ──
router.get('/zone', restrictTo('committee_member'), controller.getZoneReports)
router.get('/zone/stats', restrictTo('committee_member'), controller.getZoneStats)
router.put('/:reportId/review', restrictTo('committee_member'), controller.reviewReport)
router.get('/zone/profile', restrictTo('committee_member'), controller.getCommitteeProfile)

// ── Shared: committee_member + ngo_manager ──
router.get('/zone/staff', restrictTo('committee_member', 'ngo_manager'), controller.getZoneStaff)
router.get('/zone/volunteer-applications', restrictTo('committee_member', 'ngo_manager'), controller.getZoneVolunteerApplications)
router.patch('/zone/volunteer-applications/:applicationId/review', restrictTo('committee_member', 'ngo_manager'), controller.reviewVolunteerApplication)
router.get('/zone/tasks', restrictTo('committee_member', 'ngo_manager'), controller.getZoneTasks)
router.get('/zone/approved-volunteers', restrictTo('committee_member', 'ngo_manager'), controller.getApprovedVolunteers)

// ── Shared: any authenticated user ──
router.get('/:reportId', controller.getReport)

module.exports = router