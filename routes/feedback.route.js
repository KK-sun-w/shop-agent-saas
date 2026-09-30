const router = require('express').Router()
const { auth } = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const feedbackCtrl = require('../controllers/feedback.controller')

router.use(auth)

// 提交反馈（点赞/踩）
router.post('/',
  validate([
    { field: 'chatLogId', required: true, type: 'int' },
    { field: 'feedback', required: true, type: 'int' }
  ]),
  feedbackCtrl.submit
)

// 查看自己的反馈列表
router.get('/my', feedbackCtrl.myFeedbacks)

module.exports = router
