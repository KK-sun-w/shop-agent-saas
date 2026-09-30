// 认证服务
const bcrypt = require('bcryptjs')
const { pool } = require('../config/db')
const AppError = require('../utils/appError')
const { signToken } = require('../middlewares/auth')

async function login(username, password) {
  const [rows] = await pool.query(
    'SELECT id, tenant_id, username, password_hash, real_name, role, status FROM tenant_user WHERE username = ? LIMIT 1',
    [username]
  )
  if (!rows.length) throw new AppError(400, '用户名或密码错误', 400)
  const user = rows[0]
  if (user.status !== 1) throw new AppError(403, '账号已被禁用', 403)
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw new AppError(400, '用户名或密码错误', 400)
  const token = signToken(user)
  return {
    token,
    user: { id: user.id, tenantId: user.tenant_id, username: user.username, realName: user.real_name, role: user.role }
  }
}

// 注册（创建新租户 + 店主）
async function register({ username, password, storeName, contactName, contactPhone, address }) {
  const [exist] = await pool.query('SELECT id FROM tenant_user WHERE username = ? LIMIT 1', [username])
  if (exist.length) throw new AppError(400, '用户名已存在', 400)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [tRes] = await conn.query(
      'INSERT INTO tenant (name, contact_name, contact_phone, address) VALUES (?,?,?,?)',
      [storeName, contactName, contactPhone, address]
    )
    const tenantId = tRes.insertId
    const passwordHash = await bcrypt.hash(password, 10)
    await conn.query(
      'INSERT INTO tenant_user (tenant_id, username, password_hash, real_name, role) VALUES (?,?,?,?,?)',
      [tenantId, username, passwordHash, contactName, 'owner']
    )
    // 初始化当月配额
    const month = new Date().toISOString().slice(0, 7)
    await conn.query(
      'INSERT IGNORE INTO token_quota (tenant_id, month, quota_tokens) VALUES (?,?,1000000)',
      [tenantId, month]
    )
    await conn.commit()
    return { tenantId }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

module.exports = { login, register }
