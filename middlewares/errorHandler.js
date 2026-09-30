// 统一错误处理中间件
const env = require('../config/env')

// 404 处理
function notFound(req, res) {
  res.status(404).json({ code: 404, message: '接口不存在', data: null })
}

// 全局错误捕获
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500
  const code = err.code || 500
  const message = err.message || '服务器内部错误'

  // 开发环境打印堆栈
  if (env.nodeEnv !== 'production') {
    console.error(`[Error] ${status} ${message}`)
    console.error(err.stack)
  }

  if (status >= 500) {
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
  } else {
    res.status(status).json({ code, message, data: null })
  }
}

// 包装 async 控制器，自动捕获异常交给 errorHandler
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = { notFound, errorHandler, asyncHandler }
