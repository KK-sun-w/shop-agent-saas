// 管理员后台服务
// 创始人管理员(role=admin, tenant_id=-1)可查看全部商户数据
const { pool } = require('../config/db')

// 所有租户 Token 用量统计（按月聚合）
async function tokenStats({ month = '', page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize
  const targetMonth = month || new Date().toISOString().slice(0, 7)
  const [list] = await pool.query(
    `SELECT t.id as tenant_id, t.name as store_name,
            COALESCE(q.quota_tokens,1000000) as quota_tokens,
            COALESCE(q.used_tokens,0) as used_tokens
     FROM tenant t
     LEFT JOIN token_quota q ON q.tenant_id = t.id AND q.month = ?
     ORDER BY used_tokens DESC LIMIT ? OFFSET ?`,
    [targetMonth, Number(pageSize), offset]
  )
  const [sum] = await pool.query(
    'SELECT COALESCE(SUM(total_tokens),0) as total FROM token_usage_log WHERE DATE_FORMAT(create_time,"%Y-%m") = ?',
    [targetMonth]
  )
  return { month: targetMonth, list, totalTokens: sum[0].total }
}

// 所有商户对话记录
async function allChatLogs({ page = 1, pageSize = 20, tenantId = '', agentType = '' } = {}) {
  const offset = (page - 1) * pageSize
  let where = '1=1'
  const args = []
  if (tenantId) { where += ' AND l.tenant_id = ?'; args.push(Number(tenantId)) }
  if (agentType) { where += ' AND l.agent_type = ?'; args.push(agentType) }
  const [list] = await pool.query(
    `SELECT l.*, t.name as store_name
     FROM llm_chat_log l LEFT JOIN tenant t ON t.id = l.tenant_id
     WHERE ${where} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...args, Number(pageSize), offset]
  )
  const [total] = await pool.query(`SELECT COUNT(*) as cnt FROM llm_chat_log l WHERE ${where}`, args)
  return { list, total: total[0].cnt }
}

// 商户自己的对话记录（权限隔离）
async function myChatLogs(tenantId, { page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize
  const [list] = await pool.query(
    'SELECT * FROM llm_chat_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [tenantId, Number(pageSize), offset]
  )
  const [total] = await pool.query('SELECT COUNT(*) as cnt FROM llm_chat_log WHERE tenant_id = ?', [tenantId])
  return { list, total: total[0].cnt }
}

module.exports = { tokenStats, allChatLogs, myChatLogs }
