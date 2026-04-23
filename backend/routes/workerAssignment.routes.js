const express = require('express')
const router = express.Router()
const controller = require('../controllers/workerAssignment.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

// ── All routes require authentication ──
router.use(protect)

// ── COMMITTEE: Create assignment after approving report ──
router.post(
  '/',
  restrictTo('committee_member'),
  controller.createAssignment
)

// ── COMMITTEE: Assign volunteer to specific slot ──
router.post(
  '/:assignmentId/assign-volunteer',
  restrictTo('committee_member'),
  controller.assignVolunteerToSlot
)

// ── COMMITTEE: Get their assignments ──
router.get(
  '/my-assignments',
  restrictTo('committee_member'),
  controller.getCommitteeAssignments
)

// ── VOLUNTEER: Get pending/approved assignments ──
router.get(
  '/volunteer/pending',
  restrictTo('volunteer'),
  controller.getVolunteerPendingAssignments
)

// ── PUBLIC: Volunteer approval via email link (no auth needed) ──
router.post(
  '/approve/:token',
  controller.volunteerApproveAssignment
)

// ── PUBLIC: Volunteer rejection via email link (no auth needed) ──
router.post(
  '/reject/:token',
  controller.volunteerRejectAssignment
)

// ── SHARED: Get assignment details ──
router.get(
  '/:assignmentId',
  controller.getAssignment
)

module.exports = router