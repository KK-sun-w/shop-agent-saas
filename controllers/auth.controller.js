const { ok } = require('../utils/response')
const authService = require('../services/auth.service')

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body.username, req.body.password)
    ok(res, data, '登录成功')
  } catch (e) { next(e) }
}

const register = async (req, res, next) => {
  try {
    const data = await authService.register(req.body)
    ok(res, data, '注册成功', 0)
  } catch (e) { next(e) }
}

module.exports = { login, register }
