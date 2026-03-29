const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/superAdmin.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('super_admin'))

router.get('/stats',               controller.getStats)
router.get('/ngos',                controller.getAllNgos)
router.put('/ngos/:ngoId/approve', controller.approveNgo)
router.put('/ngos/:ngoId/decline', controller.declineNgo)
router.put('/ngos/:ngoId/suspend', controller.suspendNgo)

module.exports = router