// 环境变量集中读取，带默认值与必填校验
require('dotenv').config()

const required = ['JWT_SECRET']
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[Env] 警告: 环境变量 ${key} 未设置，使用默认值（生产环境务必修改）`)
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_NAME || 'shop_agent_db',
    user: process.env.DB_USER || 'shop_user',
    password: process.env.DB_PASSWORD || 'Shop@123456',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+08:00'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.example.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4o-mini'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 120
  },

  // Agent 运行时限制（防止 LLM 无限循环消耗 token）
  agent: {
    maxRounds: parseInt(process.env.AGENT_MAX_ROUNDS, 10) || 10,        // 单次任务最大工具调用轮次
    taskTimeoutMs: parseInt(process.env.AGENT_TASK_TIMEOUT_MS, 10) || 60000, // 单次任务总超时(ms)
    perToolTimeoutMs: parseInt(process.env.AGENT_TOOL_TIMEOUT_MS, 10) || 10000 // 单个工具超时(ms)
  }
}
