const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/upload')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('ngo_staff'))

router.post('/',
  controller.uploadMiddleware,
  controller.uploadAndProcess
)

router.get('/status/:reportId', controller.getReportStatus)

module.exports = router