const { ok } = require('../utils/response')
const adminService = require('../services/admin.service')
const feedbackService = require('../services/feedback.service')

// 管理员：所有租户 Token 用量统计
const tokenStats = async (req, res, next) => {
  try {
    const data = await adminService.tokenStats(req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

// 管理员：所有商户对话记录
const allChatLogs = async (req, res, next) => {
  try {
    const data = await adminService.allChatLogs(req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

// 商户：自己的对话记录
const myChatLogs = async (req, res, next) => {
  try {
    const data = await adminService.myChatLogs(req.user.tenantId, req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

// 管理员：全量反馈统计（点赞/踩数量）
const feedbackStats = async (req, res, next) => {
  try {
    const data = await feedbackService.adminStats()
    ok(res, data)
  } catch (e) { next(e) }
}

module.exports = { tokenStats, allChatLogs, myChatLogs, feedbackStats }
