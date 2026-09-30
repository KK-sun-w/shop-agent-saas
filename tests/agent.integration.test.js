// ============================================================
// 导师Agent + 反馈接口 集成测试 (Jest + Supertest)
// 覆盖场景:
//   1. Agent正常问答，plan/rounds/耗时字段正常入库
//   2. Agent达到最大轮次自动熔断中止，aborted=1，记录abort_reason
//   3. 普通商户访问管理员反馈统计接口，返回权限拒绝
//   4. 提交反馈点赞/踩，数据正确写入feedback表
// 执行: npx jest tests/agent.integration.test.js --verbose --forceExit
// ============================================================

// 限流放开，避免测试请求被限流
process.env.RATE_LIMIT_MAX = '9999'
process.env.RATE_LIMIT_WINDOW_MS = '60000'

const request = require('supertest')
const { pool } = require('../config/db')

// ---- Mock planner.plan，按需控制返回步骤数（executePlan 用真实实现以验证熔断）----
const mockPlan = jest.fn()
jest.mock('../services/planner.service', () => {
  const actual = jest.requireActual('../services/planner.service')
  return {
    ...actual,
    plan: (...args) => mockPlan(...args)
  }
})

const actualPlanner = jest.requireActual('../services/planner.service')
const app = require('../app')

const BASE = '/api'
let demoToken = ''
let adminToken = ''

// 辅助: 等待异步 DB 写入（mentor.service 用 setImmediate 记录日志）
const waitForDb = (ms = 300) => new Promise(r => setTimeout(r, ms))

// 辅助: 查询最新一条问答日志
async function getLatestChatLog() {
  const [rows] = await pool.query(
    'SELECT * FROM llm_chat_log ORDER BY id DESC LIMIT 1'
  )
  return rows[0] || null
}

beforeAll(async () => {
  // 登录获取 token
  const demoRes = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ username: 'demo', password: 'Demo@123456' })
  demoToken = demoRes.body.data.token

  const adminRes = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ username: 'admin', password: 'Admin@123456' })
  adminToken = adminRes.body.data.token

  expect(demoToken).toBeTruthy()
  expect(adminToken).toBeTruthy()
})

afterAll(async () => {
  await pool.end()
})

describe('场景1: Agent 正常问答 - plan/rounds/耗时字段入库', () => {
  beforeAll(() => {
    // 使用真实 planner 行为
    mockPlan.mockImplementation((...args) => actualPlanner.plan(...args))
  })

  test('接口返回 plan/rounds/elapsedMs 且数据正确写入 llm_chat_log', async () => {
    const res = await request(app)
      .post(`${BASE}/mentor/chat`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ message: '我们店周末搞什么促销活动比较好？' })

    // 接口层断言
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    const data = res.body.data
    expect(Array.isArray(data.plan)).toBe(true)
    expect(data.plan.length).toBeGreaterThan(0)
    expect(typeof data.rounds).toBe('number')
    expect(data.rounds).toBeGreaterThan(0)
    expect(data.aborted).toBe(false)
    expect(typeof data.elapsedMs).toBe('number')
    expect(data.elapsedMs).toBeGreaterThanOrEqual(0)

    // 等待异步入库完成
    await waitForDb()

    // 数据库层断言
    const log = await getLatestChatLog()
    expect(log).not.toBeNull()
    expect(log.rounds).toBe(data.rounds)
    expect(log.aborted).toBe(0)
    expect(log.elapsed_ms).toBeGreaterThanOrEqual(0)
    // plan 字段为 JSON 字符串
    expect(log.plan).toBeTruthy()
    const planArr = JSON.parse(log.plan)
    expect(Array.isArray(planArr)).toBe(true)
    expect(planArr.length).toBe(data.plan.length)
  })
})

describe('场景2: Agent 达到最大轮次自动熔断中止', () => {
  beforeAll(() => {
    // 返回 15 个步骤，超过默认 maxRounds(10)，触发熔断
    mockPlan.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        tool: 'get_store_info',
        args: {},
        reason: `step-${i}`
      }))
    )
  })

  test('aborted=true 且 abort_reason 包含"超过上限"，DB 中 aborted=1', async () => {
    const res = await request(app)
      .post(`${BASE}/mentor/chat`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ message: '测试熔断' })

    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data.aborted).toBe(true)
    expect(data.abortReason).toMatch(/超过上限/)
    expect(data.rounds).toBe(10) // 达到 maxRounds

    await waitForDb()

    const log = await getLatestChatLog()
    expect(log.aborted).toBe(1)
    expect(log.abort_reason).toMatch(/超过上限/)
    expect(log.rounds).toBe(10)
  })
})

describe('场景3: 普通商户访问管理员反馈统计接口 - 权限拒绝', () => {
  test('demo 用户访问 /admin/feedback-stats 返回 403', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/feedback-stats`)
      .set('Authorization', `Bearer ${demoToken}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe(403)
    expect(res.body.message).toMatch(/管理员|权限/)
  })

  test('admin 用户访问 /admin/feedback-stats 返回 200', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/feedback-stats`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data).toHaveProperty('like')
    expect(res.body.data).toHaveProperty('dislike')
  })
})

describe('场景4: 提交反馈点赞/踩 - 数据正确写入 feedback 表', () => {
  let chatLogId = null

  beforeAll(async () => {
    // 先调用一次问答，拿到 chat_log_id
    mockPlan.mockImplementation((...args) => actualPlanner.plan(...args))
    const res = await request(app)
      .post(`${BASE}/mentor/chat`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ message: '测试反馈' })
    await waitForDb()
    const log = await getLatestChatLog()
    chatLogId = log.id
    expect(chatLogId).toBeTruthy()
  })

  test('提交点赞 feedback=1，DB 写入成功', async () => {
    const res = await request(app)
      .post(`${BASE}/feedback`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ chatLogId, feedback: 1, comment: '回答很有帮助' })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.feedback).toBe(1)

    // 验证 DB
    const [rows] = await pool.query(
      'SELECT * FROM chat_feedback WHERE user_id = 2 AND chat_log_id = ? ORDER BY id DESC LIMIT 1',
      [chatLogId]
    )
    expect(rows.length).toBe(1)
    expect(rows[0].feedback).toBe(1)
    expect(rows[0].comment).toBe('回答很有帮助')
  })

  test('提交踩 feedback=-1，覆盖更新（upsert）', async () => {
    const res = await request(app)
      .post(`${BASE}/feedback`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ chatLogId, feedback: -1 })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.feedback).toBe(-1)

    // 验证 DB：同一 user+chat 仍只有一条，且值更新为 -1
    const [rows] = await pool.query(
      'SELECT * FROM chat_feedback WHERE user_id = 2 AND chat_log_id = ?',
      [chatLogId]
    )
    expect(rows.length).toBe(1)
    expect(rows[0].feedback).toBe(-1)
  })

  test('非法 feedback 值返回 400', async () => {
    const res = await request(app)
      .post(`${BASE}/feedback`)
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ chatLogId, feedback: 5 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/feedback/)
  })
})
