const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/report')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

// Staff routes
router.get('/my-reports',
  restrictTo('ngo_staff'),
  controller.getMyReports
)
router.put('/:reportId/visibility',
  restrictTo('ngo_staff'),
  controller.updateVisibility
)

// Committee routes
router.get('/zone',
  restrictTo('committee_member'),
  controller.getZoneReports
)
router.get('/zone/stats',
  restrictTo('committee_member'),
  controller.getZoneStats
)
router.put('/:reportId/review',
  restrictTo('committee_member'),
  controller.reviewReport
)

// Shared
router.get('/:reportId', controller.getReport)

module.exports = router