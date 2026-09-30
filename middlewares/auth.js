// JWT 鉴权中间件 + 多租户身份挂载
// 核心约束：tenant_id 仅来自 JWT，绝不信任请求体中的 tenant_id
const jwt = require('jsonwebtoken')
const env = require('../config/env')
const AppError = require('../utils/appError')

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return next(new AppError(401, '缺少登录凭证', 401))
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret)
    req.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      username: payload.username,
      role: payload.role
    }
    return next()
  } catch (e) {
    return next(new AppError(401, '登录凭证无效或已过期', 401))
  }
}

// 角色守卫：requireRole('admin') 或 requireRole(['admin','owner'])
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return function (req, res, next) {
    if (!req.user) return next(new AppError(401, '未登录', 401))
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '无权限访问', data: null })
    }
    next()
  }
}

// 创始人管理员可看全部；商户只能看自己租户
// 在需要"跨租户查看"的接口前使用此守卫
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '仅创始人管理员可访问', data: null })
  }
  next()
}

function signToken(user) {
  return jwt.sign(
    { username: user.username, tenantId: user.tenant_id, role: user.role },
    env.jwt.secret,
    { subject: String(user.id), expiresIn: env.jwt.expiresIn }
  )
}

module.exports = { auth, requireRole, adminOnly, signToken }
