// ============================================================
// LLM 调用封装（占位实现，实际接入时替换为真实 HTTP 调用）
// 支持三种模式：
//   - chat: 普通问答，返回文本回复
//   - plan: 任务规划，返回 JSON 数组 [{tool, args, reason}]
//   - answer: 基于工具结果生成最终回答
// ============================================================
const env = require('../config/env')

/**
 * 调用 LLM
 * @param {string} systemPrompt 系统提示词
 * @param {string} userInput    用户输入
 * @param {object} options      { mode: 'chat'|'plan'|'answer' }
 * @returns {Promise<{reply:string, promptTokens:number, replyTokens:number, totalTokens:number, model:string}>}
 */
async function callLLM(systemPrompt, userInput, options = {}) {
  const { mode = 'chat' } = options

  // TODO: 接入真实 LLM API（OpenAI / 通义千问 / 文心等）
  // 以下为各模式的占位模拟，保证接口链路可跑通

  let reply
  if (mode === 'plan') {
    // ---- 规划模式：返回工具调用计划 JSON ----
    reply = JSON.stringify(simulatePlan(userInput))
  } else if (mode === 'answer') {
    // ---- 回答模式：基于工具结果生成最终回复 ----
    reply = `[导师建议]\n基于门店实际数据，为您提供以下经营建议：\n${simulateAnswer(userInput)}\n\n（以上建议基于已有数据，具体执行请结合门店实际情况。）`
  } else {
    // ---- 普通聊天模式 ----
    reply = `[模拟AI回复]\n系统提示：${systemPrompt.slice(0, 80)}...\n你的问题：${userInput}\n\n（此为模拟回复，接入真实LLM后替换 callLLM 函数）`
  }

  const promptTokens = (systemPrompt.length + userInput.length) >> 2
  const replyTokens = reply.length >> 2
  return {
    reply,
    promptTokens,
    replyTokens,
    totalTokens: promptTokens + replyTokens,
    model: env.llm.model
  }
}

/**
 * 模拟规划器输出（真实环境由 LLM 生成）
 * 根据用户问题关键词决定调用哪些工具
 */
function simulatePlan(userInput) {
  const plan = []
  const q = userInput || ''
  if (/销售|营业额|业绩|营收|利润|数据/.test(q)) {
    plan.push({ tool: 'get_sales_summary', args: {}, reason: '用户询问销售/业绩数据' })
  }
  if (/记忆|历史|决策|之前|以前|上次/.test(q)) {
    plan.push({ tool: 'get_store_memory', args: {}, reason: '用户询问历史记忆/决策' })
  }
  if (/门店|店铺|信息|地址|联系|基本情况/.test(q)) {
    plan.push({ tool: 'get_store_info', args: {}, reason: '用户询问门店基本信息' })
  }
  if (/对话|聊天|记录|历史消息/.test(q)) {
    plan.push({ tool: 'get_chat_history', args: { limit: 10 }, reason: '用户询问对话记录' })
  }
  if (/token|配额|用量|消耗/.test(q)) {
    plan.push({ tool: 'get_token_usage', args: {}, reason: '用户询问Token用量' })
  }
  // 默认兜底：至少获取门店信息和记忆
  if (plan.length === 0) {
    plan.push({ tool: 'get_store_info', args: {}, reason: '获取门店基本信息作为回答依据' })
    plan.push({ tool: 'get_store_memory', args: {}, reason: '获取历史记忆辅助回答' })
  }
  return plan
}

/**
 * 模拟最终回答（真实环境由 LLM 基于工具结果生成）
 */
function simulateAnswer(userInput) {
  return `1. 建议先梳理当前商品结构，确认主力品类库存。\n2. 结合历史决策保持供应商一致性，降低采购风险。\n3. 可尝试周末限时促销，但需先核算成本与毛利。`
}

module.exports = { callLLM, simulatePlan }
