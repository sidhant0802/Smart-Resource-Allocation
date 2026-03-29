const express    = require('express')
const router     = express.Router()
const controller = require('../controllers/chat')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)
router.use(restrictTo('ngo_staff'))

router.post('/',               controller.sendMessage)
router.get('/:reportId',       controller.getChatHistory)

module.exports = router