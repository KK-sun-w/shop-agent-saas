// ============================================================
// 门店商业导师 Agent
// 职责：
//   1) 自动读取店铺历史记忆
//   2) Planner 拆解任务 → 规划工具调用顺序
//   3) 执行工具（白名单校验 + 租户隔离 + 轮次/超时限制）
//   4) 基于工具结果 + 护栏 生成最终回答
//   5) 记录问答日志与 Token 消耗
// ============================================================
const { callLLM } = require('../utils/llm')
const memoryService = require('./memory.service')
const tokenService = require('./token.service')
const planner = require('./planner.service')
const guardrails = require('./guardrails')
const env = require('../config/env')
const AppError = require('../utils/appError')

/**
 * 导师问答
 * @param {object} param
 * @param {number} param.tenantId
 * @param {number} param.userId
 * @param {string} param.userInput
 */
async function chat({ tenantId, userId, userInput }) {
  const startTime = Date.now()
  const limits = {
    maxRounds: env.agent.maxRounds,
    taskTimeoutMs: env.agent.taskTimeoutMs,
    perToolTimeoutMs: env.agent.perToolTimeoutMs
  }

  // 1. 自动读取店铺记忆注入 prompt
  const memoryText = await memoryService.getMemoryForPrompt(tenantId, 5)

  // 2. Planner 拆解任务，规划工具调用顺序
  const steps = await planner.plan(userInput)

  // 3. 执行工具计划（带白名单 + 租户边界 + 轮次/超时限制）
  const { results: toolResults, rounds, aborted, abortReason } = await planner.executePlan(
    steps,
    { tenantId },
    limits
  )

  // 4. 组装带护栏的系统提示词
  const systemPrompt = guardrails.buildMentorPrompt(memoryText, toolResults)

  // 5. 调用 LLM 生成最终回答
  const { reply, promptTokens, replyTokens, totalTokens, model } = await callLLM(
    systemPrompt,
    userInput,
    { mode: 'answer' }
  )

  // 6. 异步记录问答日志与 Token 消耗（不阻塞响应）
  setImmediate(() => {
    tokenService.recordUsage({
      tenantId, userId, agentType: 'mentor',
      userInput, aiReply: reply,
      promptTokens, replyTokens, totalTokens, model,
      plan: steps, rounds, aborted, abortReason, elapsedMs: Date.now() - startTime
    }).catch(e => console.error('[Mentor] 记录Token消耗失败:', e.message))
  })

  return {
    reply,
    promptTokens,
    replyTokens,
    totalTokens,
    model,
    plan: steps,
    toolResults,
    rounds,
    aborted,
    abortReason,
    elapsedMs: Date.now() - startTime
  }
}

module.exports = { chat }
