// ============================================================
// 门店AI Agent SaaS 系统 - 入口
// 启动：node app.js  或  pm2 start ecosystem.config.js
// ============================================================
const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const env = require('./config/env')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const routes = require('./routes')

const app = express()

// ---- 全局中间件 ----
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// 全局限流
app.use(rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: { code: 429, message: '请求过于频繁,请稍后再试', data: null }
}))

// 请求日志（简易）
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
  })
  next()
})

// ---- 路由 ----
app.get('/health', (req, res) => res.json({ code: 0, message: 'ok', data: { ts: Date.now() } }))
app.use('/api', routes)

// ---- 错误处理 ----
app.use(notFound)
app.use(errorHandler)

// 进程级异常兜底，避免崩溃
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err)
})

// 仅在直接运行时启动监听（被测试 require 时不监听端口）
if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`[Server] 服务已启动: http://127.0.0.1:${env.port} (${env.nodeEnv})`)
    console.log(`[Server] 健康检查: http://127.0.0.1:${env.port}/health`)
  })
}

module.exports = app
