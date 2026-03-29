const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/ngoManager')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('ngo_manager'))

router.get('/dashboard',                        controller.getDashboard)
router.post('/zones',                           controller.createZone)
router.delete('/zones/:zoneId',                 controller.deleteZone)
router.put('/committee/:memberId/approve',      controller.approveCommitteeMember)
router.put('/staff/:memberId/approve',          controller.approveStaff)
router.put('/users/:memberId/decline',          controller.declineUser)

module.exports = router