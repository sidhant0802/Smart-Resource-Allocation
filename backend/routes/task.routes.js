const express = require('express')
const router = express.Router()
const controller = require('../controllers/task.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

// ═══════════════════════════════════════
// Volunteer routes
// ═══════════════════════════════════════

// Volunteer applies to an open task (pending approval)
router.post('/:taskId/apply',
  restrictTo('volunteer'),
  controller.applyToTask
)

// Respond to task invitation (pre-invited)
router.post('/:taskId/respond',
  restrictTo('volunteer'),
  controller.respondToInvitation
)

// Mark task as complete
router.patch('/:taskId/complete',
  restrictTo('volunteer'),
  controller.completeTask
)

// Get task details
router.get('/:taskId',
  controller.getTaskDetails
)

// ═══════════════════════════════════════
// Committee routes
// ═══════════════════════════════════════

// Get pending volunteer applications
router.get('/applications/pending',
  restrictTo('committee_member', 'ngo_manager'),
  controller.getPendingApplications
)

// Approve or reject volunteer application
router.patch('/:taskId/volunteers/:volunteerId/review',
  restrictTo('committee_member', 'ngo_manager'),
  controller.reviewVolunteerApplication
)

// ═══════════════════════════════════════
// Committee/NGO Manager routes
// ═══════════════════════════════════════

router.post('/',
  restrictTo('committee_member', 'ngo_manager'),
  controller.createTask
)

router.patch('/:taskId/duration',
  restrictTo('committee_member', 'ngo_manager'),
  controller.updateTaskDuration
)

router.post('/:taskId/assign-volunteers',
  restrictTo('committee_member', 'ngo_manager'),
  controller.assignVolunteers
)

module.exports = router