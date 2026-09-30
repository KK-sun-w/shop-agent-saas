const router = require('express').Router()
const { auth, adminOnly } = require('../middlewares/auth')
const adminCtrl = require('../controllers/admin.controller')

router.use(auth)

// 商户：自己的对话记录
router.get('/my-chat-logs', adminCtrl.myChatLogs)

// 管理员：全量数据
router.get('/token-stats', adminOnly, adminCtrl.tokenStats)
router.get('/all-chat-logs', adminOnly, adminCtrl.allChatLogs)
router.get('/feedback-stats', adminOnly, adminCtrl.feedbackStats)

module.exports = router
