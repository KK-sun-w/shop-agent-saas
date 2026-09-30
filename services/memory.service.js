// 店铺记忆服务
// 核心能力：1) CRUD 记忆  2) 生成注入到 Agent prompt 的记忆文本
const { pool } = require('../config/db')
const AppError = require('../utils/appError')

// 列表
async function list(tenantId, { page = 1, pageSize = 20, type = '' } = {}) {
  const offset = (page - 1) * pageSize
  let where = 'tenant_id = ? AND deleted = 0'
  const args = [tenantId]
  if (type) { where += ' AND memory_type = ?'; args.push(type) }
  const [list] = await pool.query(
    `SELECT * FROM shop_memory WHERE ${where} ORDER BY importance DESC, id DESC LIMIT ? OFFSET ?`,
    [...args, Number(pageSize), offset]
  )
  const [total] = await pool.query(`SELECT COUNT(*) as cnt FROM shop_memory WHERE ${where}`, args)
  return { list, total: total[0].cnt }
}

// 新增
async function create(tenantId, { memory_type, memory_content, importance = 5, source = 'manual' }) {
  const [res] = await pool.query(
    'INSERT INTO shop_memory (tenant_id, memory_type, memory_content, importance, source) VALUES (?,?,?,?,?)',
    [tenantId, memory_type, String(memory_content), importance, source]
  )
  return { id: res.insertId }
}

// 更新
async function update(tenantId, id, body) {
  const sets = []
  const args = []
  const allowed = ['memory_type', 'memory_content', 'importance']
  for (const k of allowed) {
    if (body[k] !== undefined) { sets.push(`${k} = ?`); args.push(body[k]) }
  }
  if (!sets.length) throw new AppError(400, '没有可更新的字段', 400)
  args.push(tenantId, id)
  const [res] = await pool.query(`UPDATE shop_memory SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`, args)
  if (!res.affectedRows) throw new AppError(404, '记忆不存在', 404)
  return { id }
}

// 删除（软删）
async function remove(tenantId, id) {
  const [res] = await pool.query('UPDATE shop_memory SET deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id])
  if (!res.affectedRows) throw new AppError(404, '记忆不存在', 404)
  return { id }
}

/**
 * 生成注入到 Agent prompt 的记忆文本
 * 每次 Agent 调用前自动读取
 * @param {number} tenantId
 * @param {number} minImportance 最低权重门槛
 * @returns {Promise<string>}
 */
async function getMemoryForPrompt(tenantId, minImportance = 5) {
  const [rows] = await pool.query(
    `SELECT memory_type, memory_content, importance FROM shop_memory
     WHERE tenant_id = ? AND deleted = 0 AND importance >= ?
     ORDER BY importance DESC, id DESC LIMIT 50`,
    [tenantId, minImportance]
  )
  if (!rows.length) return ''
  const lines = ['## 店铺长期记忆(以下信息来自历史经营,供你参考)']
  for (const r of rows) {
    const label = r.memory_type === 'user_decision' ? '店主决策'
      : r.memory_type === 'shop_attr' ? '店铺属性'
      : r.memory_type === 'sales_data' ? '经营数据' : '记忆'
    lines.push(`[${label}](权重${r.importance}) ${r.memory_content}`)
  }
  return lines.join('\n')
}

module.exports = { list, create, update, remove, getMemoryForPrompt }
