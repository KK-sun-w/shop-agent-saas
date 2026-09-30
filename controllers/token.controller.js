const { ok } = require('../utils/response')
const tokenService = require('../services/token.service')

// 商户查看自己当月配额
const myQuota = async (req, res, next) => {
  try {
    const data = await tokenService.getQuota(req.user.tenantId)
    ok(res, data)
  } catch (e) { next(e) }
}

// 商户查看自己的 token 消耗明细
const myUsage = async (req, res, next) => {
  try {
    const data = await tokenService.myUsageLogs(req.user.tenantId, req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

module.exports = { myQuota, myUsage }
