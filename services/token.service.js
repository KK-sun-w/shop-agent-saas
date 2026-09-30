// Token 计费服务
// 职责：1) 记录每次 LLM 调用的 token 消耗  2) 记录问答日志  3) 配额校验
const { pool } = require('../config/db')

// 记录一次 LLM 调用（问答日志 + token 消耗 + 配额扣减），事务保证一致性
async function recordUsage({ tenantId, userId, agentType, userInput, aiReply, promptTokens, replyTokens, totalTokens, model, status = 'success', errorMsg = null, plan = null, rounds = 0, aborted = false, abortReason = null, elapsedMs = 0 }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [chatRes] = await conn.query(
      `INSERT INTO llm_chat_log
       (tenant_id, user_id, agent_type, user_input, ai_reply, plan, rounds, aborted, abort_reason, elapsed_ms, prompt_tokens, reply_tokens, total_tokens, status, error_msg)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tenantId, userId, agentType, userInput, aiReply || null,
       plan ? JSON.stringify(plan) : null,
       rounds, aborted ? 1 : 0, abortReason || null, elapsedMs,
       promptTokens, replyTokens, totalTokens, status, errorMsg]
    )
    const chatLogId = chatRes.insertId
    await conn.query(
      `INSERT INTO token_usage_log
       (tenant_id, user_id, chat_log_id, agent_type, prompt_tokens, reply_tokens, total_tokens, model)
       VALUES (?,?,?,?,?,?,?,?)`,
      [tenantId, userId, chatLogId, agentType, promptTokens, replyTokens, totalTokens, model || null]
    )
    // 累加当月已用配额
    const month = new Date().toISOString().slice(0, 7)
    await conn.query(
      `INSERT INTO token_quota (tenant_id, month, quota_tokens, used_tokens)
       VALUES (?,?,1000000,?)
       ON DUPLICATE KEY UPDATE used_tokens = used_tokens + VALUES(used_tokens)`,
      [tenantId, month, totalTokens]
    )
    await conn.commit()
    return { chatLogId }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

// 查询某租户当月配额使用情况
async function getQuota(tenantId) {
  const month = new Date().toISOString().slice(0, 7)
  const [rows] = await pool.query(
    'SELECT * FROM token_quota WHERE tenant_id = ? AND month = ? LIMIT 1',
    [tenantId, month]
  )
  if (!rows.length) return { tenant_id: tenantId, month, quota_tokens: 1000000, used_tokens: 0 }
  return rows[0]
}

// 商户查看自己的 token 消耗明细
async function myUsageLogs(tenantId, { page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize
  const [list] = await pool.query(
    'SELECT * FROM token_usage_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [tenantId, Number(pageSize), offset]
  )
  const [total] = await pool.query('SELECT COUNT(*) as cnt FROM token_usage_log WHERE tenant_id = ?', [tenantId])
  const [sum] = await pool.query('SELECT COALESCE(SUM(total_tokens),0) as total FROM token_usage_log WHERE tenant_id = ?', [tenantId])
  return { list, total: total[0].cnt, totalTokens: sum[0].total }
}

module.exports = { recordUsage, getQuota, myUsageLogs }
