const { ok } = require('../utils/response')
const memoryService = require('../services/memory.service')

const list = async (req, res, next) => {
  try {
    const data = await memoryService.list(req.user.tenantId, req.query)
    ok(res, data)
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    const data = await memoryService.create(req.user.tenantId, req.body)
    ok(res, data, '创建成功')
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const data = await memoryService.update(req.user.tenantId, Number(req.params.id), req.body)
    ok(res, data, '更新成功')
  } catch (e) { next(e) }
}

const remove = async (req, res, next) => {
  try {
    const data = await memoryService.remove(req.user.tenantId, Number(req.params.id))
    ok(res, data, '删除成功')
  } catch (e) { next(e) }
}

// 调试用：查看注入到 Agent 的记忆文本
const preview = async (req, res, next) => {
  try {
    const text = await memoryService.getMemoryForPrompt(req.user.tenantId, req.query.minImportance || 5)
    ok(res, { memory_text: text })
  } catch (e) { next(e) }
}

module.exports = { list, create, update, remove, preview }
