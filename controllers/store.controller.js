const { ok } = require('../utils/response')
const storeService = require('../services/store.service')

const getMyStore = async (req, res, next) => {
  try {
    const data = await storeService.getMyStore(req.user.tenantId)
    ok(res, data)
  } catch (e) { next(e) }
}

const updateStore = async (req, res, next) => {
  try {
    const data = await storeService.updateStore(req.user.tenantId, req.body)
    ok(res, data, '更新成功')
  } catch (e) { next(e) }
}

// 管理员：所有门店
const listAll = async (req, res, next) => {
  try {
    const data = await storeService.listAll(req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

module.exports = { getMyStore, updateStore, listAll }
