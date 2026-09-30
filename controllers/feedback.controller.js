const { ok } = require('../utils/response')
const feedbackService = require('../services/feedback.service')

// 提交反馈（点赞/踩）
const submit = async (req, res, next) => {
  try {
    const data = await feedbackService.submit({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      chatLogId: req.body.chatLogId,
      feedback: req.body.feedback,
      comment: req.body.comment
    })
    ok(res, data, '反馈提交成功')
  } catch (e) { next(e) }
}

// 商户查看自己的反馈列表
const myFeedbacks = async (req, res, next) => {
  try {
    const data = await feedbackService.myFeedbacks(req.user.tenantId, req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

module.exports = { submit, myFeedbacks }
