// ============================================================
// 对话反馈服务
// 职责：商户对 Agent 回答点赞/踩，反馈数据存入数据库用于产品复盘
// ============================================================
const { pool } = require('../config/db')
const AppError = require('../utils/appError')

/**
 * 提交/更新反馈（同一用户对同一条对话只能有一条反馈，重复提交为更新）
 * @param {object} param
 * @param {number} param.tenantId  租户ID（来自JWT）
 * @param {number} param.userId    用户ID（来自JWT）
 * @param {number} param.chatLogId 对话记录ID
 * @param {number} param.feedback  1=点赞, -1=踩, 0=取消
 * @param {string} [param.comment] 可选备注
 */
async function submit({ tenantId, userId, chatLogId, feedback, comment = null }) {
  const fb = Number(feedback)
  if (![-1, 0, 1].includes(fb)) {
    throw new AppError(400, 'feedback 取值必须为 1(点赞)、-1(踩)、0(取消)', 400)
  }
  // 校验对话记录属于该租户（数据边界）
  const [logs] = await pool.query(
    'SELECT id FROM llm_chat_log WHERE id = ? AND tenant_id = ? LIMIT 1',
    [chatLogId, tenantId]
  )
  if (!logs.length) {
    throw new AppError(404, '对话记录不存在或无权操作', 404)
  }

  // upsert：同一用户对同一对话只有一条反馈
  await pool.query(
    `INSERT INTO chat_feedback (tenant_id, user_id, chat_log_id, feedback, comment)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE feedback = VALUES(feedback), comment = VALUES(comment), create_time = CURRENT_TIMESTAMP`,
    [tenantId, userId, chatLogId, fb, comment]
  )
  return { chatLogId, feedback: fb }
}

/**
 * 商户查看自己的反馈列表
 */
async function myFeedbacks(tenantId, { page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize
  const [list] = await pool.query(
    `SELECT f.*, l.user_input, l.ai_reply
     FROM chat_feedback f
     LEFT JOIN llm_chat_log l ON l.id = f.chat_log_id
     WHERE f.tenant_id = ?
     ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [tenantId, Number(pageSize), offset]
  )
  const [total] = await pool.query('SELECT COUNT(*) as cnt FROM chat_feedback WHERE tenant_id = ?', [tenantId])
  return { list, total: total[0].cnt }
}

/**
 * 管理员：全量反馈统计（点赞/踩数量）
 */
async function adminStats() {
  const [rows] = await pool.query(
    `SELECT feedback, COUNT(*) as cnt FROM chat_feedback GROUP BY feedback`
  )
  const result = { like: 0, dislike: 0, cancel: 0 }
  for (const r of rows) {
    if (r.feedback === 1) result.like = r.cnt
    else if (r.feedback === -1) result.dislike = r.cnt
    else result.cancel = r.cnt
  }
  return result
}

module.exports = { submit, myFeedbacks, adminStats }
