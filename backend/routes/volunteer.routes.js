const express = require('express')
const router = express.Router()
const controller = require('../controllers/volunteer.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

// ── Dashboard ──
router.get('/dashboard', restrictTo('volunteer'), controller.getDashboardData)

// ── Available Tasks ──
router.get('/tasks', restrictTo('volunteer'), controller.getAvailableTasks)

// ── ✅ Apply to Task ──
router.post('/tasks/:taskId/apply', restrictTo('volunteer'), controller.applyToTask)

// ── ✅ Get applied task IDs ──
router.get('/tasks/applied-ids', restrictTo('volunteer'), controller.getAppliedTaskIds)

// ── ✅ Get my assignments (from committee) ──
router.get('/my-assignments', restrictTo('volunteer'), controller.getMyAssignments)

// ── ✅ Get available tasks in area (for NGO staff) ──
router.get('/tasks-in-area', restrictTo('ngo_staff', 'volunteer'), controller.getTasksInArea)

// ── ✅ My task applications (for NGO staff) ──
router.get('/my-task-applications', restrictTo('ngo_staff', 'volunteer'), controller.getMyTaskApplications)

// ── NGO ──
router.post('/apply-ngo', restrictTo('volunteer'), controller.applyToNGO)
router.get('/my-ngos', restrictTo('volunteer'), controller.getMyNGOs)

// ── Profile ──
router.put('/profile', restrictTo('volunteer'), controller.updateProfile)
router.put('/location', restrictTo('volunteer'), controller.updateLocation)

module.exports = router