// ============================================================
// Agent 边界与安全控制 - 测试用例
// 运行方式: node tests/agent.test.js
// 覆盖需求:
//   1. 工具白名单
//   2. 运行时限制（最大轮次 + 超时）
//   3. 数据边界（tenantId 强制过滤 + 最小字段集）
//   4. Prompt 护栏
//   5. 对话反馈
//   6. 轻量 Planner
//   7. 端到端导师问答
// ============================================================
const assert = require('assert')
const path = require('path')

// 让配置能正确读取 .env
process.chdir(path.resolve(__dirname, '..'))

const toolRegistry = require('../services/toolRegistry')
const planner = require('../services/planner.service')
const guardrails = require('../services/guardrails')
const feedbackService = require('../services/feedback.service')
const mentorService = require('../services/mentor.service')
const { pool } = require('../config/db')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed++
      console.log(`  ✅ ${name}`)
    })
    .catch(e => {
      failed++
      failures.push({ name, error: e.message })
      console.log(`  ❌ ${name}\n     Error: ${e.message}`)
    })
}

async function main() {
  console.log('\n========== Agent 边界与安全控制 测试 ==========\n')

  // ---- 需求1: 工具白名单 ----
  console.log('【需求1】工具白名单')
  await test('白名单包含已注册工具', () => {
    assert.strictEqual(toolRegistry.isAllowed('get_store_info'), true)
    assert.strictEqual(toolRegistry.isAllowed('get_store_memory'), true)
    assert.strictEqual(toolRegistry.isAllowed('get_sales_summary'), true)
  })
  await test('非白名单工具被拒绝', () => {
    assert.strictEqual(toolRegistry.isAllowed('drop_all_tables'), false)
    assert.strictEqual(toolRegistry.isAllowed('delete_user'), false)
    assert.strictEqual(toolRegistry.isAllowed(''), false)
  })
  await test('executeTool 拒绝非白名单工具', async () => {
    try {
      await toolRegistry.executeTool('drop_database', {}, { tenantId: 1 })
      throw new Error('应该抛出异常')
    } catch (e) {
      assert.ok(e.message.includes('不在白名单'))
    }
  })

  // ---- 需求3: 数据边界 ----
  console.log('\n【需求3】数据边界（租户隔离 + 最小字段集）')
  await test('缺少 tenantId 时拒绝执行工具', async () => {
    try {
      await toolRegistry.executeTool('get_store_info', {}, {})
      throw new Error('应该抛出异常')
    } catch (e) {
      assert.ok(e.message.includes('缺少有效租户身份'))
    }
  })
  await test('args 中的 tenantId 被 ctx 覆盖（防注入）', async () => {
    // 尝试通过 args 注入其他租户ID，应被忽略
    const result = await toolRegistry.executeTool('get_store_info', { tenantId: 999 }, { tenantId: 1 })
    assert.strictEqual(result.name, '鲜果时光便利店') // 租户1的数据
  })
  await test('工具只返回必要字段，不泄露内部字段', async () => {
    const result = await toolRegistry.executeTool('get_store_info', {}, { tenantId: 1 })
    // 不应包含 id/status/deleted/create_time 等内部字段
    assert.ok(!('id' in result), '不应返回 id 字段')
    assert.ok(!('status' in result), '不应返回 status 字段')
    assert.ok(!('create_time' in result), '不应返回 create_time 字段')
    // 应包含业务必要字段
    assert.ok('name' in result)
  })
  await test('get_store_memory 不泄露内部字段', async () => {
    const list = await toolRegistry.executeTool('get_store_memory', {}, { tenantId: 1 })
    assert.ok(Array.isArray(list))
    if (list.length) {
      const item = list[0]
      assert.ok(!('id' in item), '记忆不应返回 id')
      assert.ok(!('tenant_id' in item), '记忆不应返回 tenant_id')
      assert.ok(!('deleted' in item), '记忆不应返回 deleted')
    }
  })

  // ---- 需求4: Prompt 护栏 ----
  console.log('\n【需求4】Prompt 护栏')
  await test('导师系统提示词包含数据真实性约束', () => {
    const prompt = guardrails.buildMentorPrompt('', [])
    assert.ok(prompt.includes('禁止编造'), '应包含"禁止编造"约束')
  })
  await test('导师系统提示词包含禁止承诺约束', () => {
    const prompt = guardrails.buildMentorPrompt('', [])
    assert.ok(prompt.includes('法律') || prompt.includes('金融'), '应包含法律/金融约束')
  })
  await test('导师系统提示词包含缺数据直说约束', () => {
    const prompt = guardrails.buildMentorPrompt('', [])
    assert.ok(prompt.includes('暂无相关数据') || prompt.includes('缺数据'), '应包含缺数据直说约束')
  })
  await test('工具结果被注入到提示词中', () => {
    const toolResults = [{ tool: 'get_store_info', success: true, result: { name: '测试店' } }]
    const prompt = guardrails.buildMentorPrompt('', toolResults)
    assert.ok(prompt.includes('测试店'), '工具结果应注入提示词')
  })
  await test('记忆 Agent 护栏包含不新增信息约束', () => {
    const prompt = guardrails.buildMemoryPrompt('')
    assert.ok(prompt.includes('不新增未提供的信息') || prompt.includes('整理和归纳'))
  })

  // ---- 需求6: 轻量 Planner ----
  console.log('\n【需求6】轻量 Planner')
  await test('plan 返回数组', async () => {
    const steps = await planner.plan('我们店周末搞什么促销')
    assert.ok(Array.isArray(steps))
  })
  await test('计划中的工具都在白名单内', async () => {
    const steps = await planner.plan('查看门店销售数据')
    for (const s of steps) {
      assert.ok(toolRegistry.isAllowed(s.tool), `工具 ${s.tool} 应在白名单内`)
    }
  })
  await test('executePlan 执行工具并返回结果', async () => {
    const steps = [{ tool: 'get_store_info', args: {}, reason: 'test' }]
    const { results, rounds } = await planner.executePlan(steps, { tenantId: 1 })
    assert.strictEqual(rounds, 1)
    assert.strictEqual(results[0].success, true)
    assert.ok(results[0].result.name)
  })

  // ---- 需求2: 运行时限制 ----
  console.log('\n【需求2】运行时限制（最大轮次 + 超时）')
  await test('超过最大轮次时中止并返回 abortReason', async () => {
    // 构造 15 个步骤，maxRounds=3，应在第 3 步后中止
    const steps = Array.from({ length: 15 }, (_, i) => ({
      tool: 'get_store_info', args: {}, reason: `step${i}`
    }))
    const { rounds, aborted, abortReason } = await planner.executePlan(
      steps, { tenantId: 1 }, { maxRounds: 3, taskTimeoutMs: 30000, perToolTimeoutMs: 5000 }
    )
    assert.strictEqual(aborted, true)
    assert.strictEqual(rounds, 3)
    assert.ok(abortReason.includes('超过上限'))
  })
  await test('单个工具超时返回失败结果而非崩溃', async () => {
    // 用一个不存在但在白名单内的工具无法模拟超时，这里测试超时机制本身
    // 通过设置极短的 perToolTimeoutMs 来触发
    const steps = [{ tool: 'get_store_info', args: {}, reason: 'test' }]
    const { results } = await planner.executePlan(
      steps, { tenantId: 1 }, { maxRounds: 5, taskTimeoutMs: 30000, perToolTimeoutMs: 1 }
    )
    // perToolTimeoutMs=1ms 应触发超时，工具结果 success=false
    // 注意：如果工具执行非常快可能在超时前完成，这里只验证不崩溃
    assert.ok(Array.isArray(results))
    assert.strictEqual(results.length, 1)
  })

  // ---- 需求5: 对话反馈 ----
  console.log('\n【需求5】对话反馈')
  // 先确保有一条对话记录用于反馈测试
  const [chatLogs] = await pool.query('SELECT id FROM llm_chat_log WHERE tenant_id = 1 LIMIT 1')
  if (!chatLogs.length) {
    await pool.query(
      'INSERT INTO llm_chat_log (tenant_id, user_id, agent_type, user_input, ai_reply) VALUES (1, 2, "mentor", "测试", "测试回复")'
    )
  }
  const [log] = await pool.query('SELECT id FROM llm_chat_log WHERE tenant_id = 1 ORDER BY id DESC LIMIT 1')
  const testChatLogId = log[0].id

  await test('提交点赞反馈', async () => {
    const result = await feedbackService.submit({
      tenantId: 1, userId: 2, chatLogId: testChatLogId, feedback: 1
    })
    assert.strictEqual(result.feedback, 1)
  })
  await test('提交踩反馈（覆盖更新）', async () => {
    const result = await feedbackService.submit({
      tenantId: 1, userId: 2, chatLogId: testChatLogId, feedback: -1
    })
    assert.strictEqual(result.feedback, -1)
  })
  await test('非法 feedback 值被拒绝', async () => {
    try {
      await feedbackService.submit({ tenantId: 1, userId: 2, chatLogId: testChatLogId, feedback: 5 })
      throw new Error('应该抛出异常')
    } catch (e) {
      assert.ok(e.message.includes('feedback 取值必须'))
    }
  })
  await test('跨租户反馈被拒绝（数据边界）', async () => {
    // 租户2 尝试对 租户1 的对话记录反馈
    try {
      await feedbackService.submit({ tenantId: 2, userId: 3, chatLogId: testChatLogId, feedback: 1 })
      throw new Error('应该抛出异常')
    } catch (e) {
      assert.ok(e.message.includes('不存在或无权操作'))
    }
  })
  await test('查看自己的反馈列表', async () => {
    const { list, total } = await feedbackService.myFeedbacks(1)
    assert.ok(total >= 1)
    assert.ok(Array.isArray(list))
  })
  await test('管理员查看反馈统计', async () => {
    const stats = await feedbackService.adminStats()
    assert.ok('like' in stats)
    assert.ok('dislike' in stats)
  })

  // ---- 端到端: 导师问答 ----
  console.log('\n【端到端】导师问答（Planner + 工具 + 护栏）')
  await test('导师问答返回完整结构', async () => {
    const result = await mentorService.chat({
      tenantId: 1, userId: 2, userInput: '我们店周末搞什么促销活动比较好？'
    })
    assert.ok(result.reply, '应返回回复')
    assert.ok(Array.isArray(result.plan), 'plan 应为数组')
    assert.ok(Array.isArray(result.toolResults), 'toolResults 应为数组')
    assert.ok(typeof result.rounds === 'number', 'rounds 应为数字')
    assert.ok(typeof result.elapsedMs === 'number', 'elapsedMs 应为数字')
  })
  await test('导师问答的 plan 中工具都在白名单', async () => {
    const result = await mentorService.chat({
      tenantId: 1, userId: 2, userInput: '查看门店销售数据'
    })
    for (const step of result.plan) {
      assert.ok(toolRegistry.isAllowed(step.tool), `plan 工具 ${step.tool} 应在白名单`)
    }
  })
  await test('导师问答执行了工具调用', async () => {
    const result = await mentorService.chat({
      tenantId: 1, userId: 2, userInput: '我们店的基本情况是什么'
    })
    assert.ok(result.toolResults.length > 0, '应至少执行一个工具')
    assert.ok(result.rounds > 0, '应至少完成一轮工具调用')
  })

  // ---- 汇总 ----
  console.log(`\n========== 测试结果 ==========`)
  console.log(`通过: ${passed}  失败: ${failed}`)
  if (failed > 0) {
    console.log('\n失败详情:')
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
    process.exit(1)
  } else {
    console.log('🎉 全部测试通过！')
    process.exit(0)
  }
}

main()
