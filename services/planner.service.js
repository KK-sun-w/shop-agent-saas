// ============================================================
// 轻量 Planner 任务规划器
// 职责：用户提问后，先拆解需要执行的任务，规划工具调用顺序，再执行
// 流程：userInput → LLM(plan模式) → 解析JSON计划 → 校验工具白名单 → 返回计划
// ============================================================
const { callLLM } = require('../utils/llm')
const { isAllowed, getToolDescriptions } = require('./toolRegistry')
const AppError = require('../utils/appError')

const PLANNER_SYSTEM_PROMPT = `你是一个任务规划助手。根据用户问题，拆解成需要按顺序调用的工具序列。

可用工具白名单（只能从以下工具中选择）：
${getToolDescriptions()}

请严格返回 JSON 数组，每个元素格式为：
{ "tool": "工具名", "args": { ... }, "reason": "为什么调用这个工具" }

规则：
1. 只能使用白名单内的工具
2. 按执行顺序排列
3. 不需要工具时返回空数组 []
4. 只返回 JSON，不要其他文字`

/**
 * 规划任务
 * @param {string} userInput 用户问题
 * @returns {Promise<Array<{tool:string, args:object, reason:string}>>}
 */
async function plan(userInput) {
  const { reply } = await callLLM(PLANNER_SYSTEM_PROMPT, userInput, { mode: 'plan' })

  // 解析 LLM 返回的 JSON
  let steps = []
  try {
    // 提取 JSON 数组（兼容 LLM 可能夹带的说明文字）
    const jsonMatch = reply.match(/\[[\s\S]*\]/)
    steps = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch (e) {
    // 解析失败时返回空计划，不阻塞主流程
    console.warn('[Planner] 计划解析失败，回退为空计划:', e.message)
    steps = []
  }

  // 校验：过滤掉不在白名单的工具 + 格式非法的步骤
  const validSteps = []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    if (!step.tool || typeof step.tool !== 'string') continue
    if (!isAllowed(step.tool)) {
      console.warn(`[Planner] 工具 "${step.tool}" 不在白名单，已跳过`)
      continue
    }
    validSteps.push({
      tool: step.tool,
      args: step.args && typeof step.args === 'object' ? step.args : {},
      reason: step.reason || ''
    })
  }

  return validSteps
}

/**
 * 执行计划（带运行时限制：最大轮次 + 超时）
 * @param {Array} steps 计划步骤
 * @param {object} ctx 上下文 { tenantId }
 * @param {object} limits { maxRounds, taskTimeoutMs, perToolTimeoutMs }
 * @returns {Promise<{results:Array, rounds:number, aborted:boolean, abortReason:string|null}>}
 */
async function executePlan(steps, ctx, limits = {}) {
  const {
    maxRounds = 10,
    taskTimeoutMs = 60000,
    perToolTimeoutMs = 10000
  } = limits

  const { executeTool } = require('./toolRegistry')
  const startTime = Date.now()
  const results = []
  let rounds = 0
  let aborted = false
  let abortReason = null

  for (const step of steps) {
    // 轮次上限检查
    if (rounds >= maxRounds) {
      aborted = true
      abortReason = `工具调用轮次超过上限(${maxRounds})，已终止`
      break
    }
    // 整体任务超时检查
    if (Date.now() - startTime > taskTimeoutMs) {
      aborted = true
      abortReason = `任务执行超时(${taskTimeoutMs}ms)，已终止`
      break
    }

    try {
      // 单个工具超时保护
      const result = await withTimeout(
        executeTool(step.tool, step.args, ctx),
        perToolTimeoutMs,
        `工具 ${step.tool} 执行超时(${perToolTimeoutMs}ms)`
      )
      results.push({ tool: step.tool, success: true, result, reason: step.reason })
    } catch (e) {
      results.push({ tool: step.tool, success: false, error: e.message, reason: step.reason })
    }
    rounds++
  }

  return { results, rounds, aborted, abortReason }
}

/**
 * Promise 超时包装
 */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new AppError(408, message || '执行超时', 408)), ms)
    )
  ])
}

module.exports = { plan, executePlan }
