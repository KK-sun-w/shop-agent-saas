// ============================================================
// 工具白名单注册表 (Tool Whitelist Registry)
// 职责：
//   1) 定义 Agent 可调用的全部工具（白名单）
//   2) 执行前校验工具是否在白名单内
//   3) 强制租户隔离：tenantId 仅来自 JWT 上下文，忽略工具参数中的 tenantId
//   4) 数据最小化：只提取必要字段返回给 LLM，减少 token 开销
// ============================================================
const { pool } = require('../config/db')
const memoryService = require('./memory.service')
const storeService = require('./store.service')
const AppError = require('../utils/appError')

/**
 * 工具定义表
 * 每个工具必须：
 *  - 显式声明 name/description
 *  - execute 内部所有查询强制带 tenant_id 过滤
 *  - 只返回 LLM 需要的最小字段集
 */
const TOOLS = {
  // ---- 工具1: 获取门店基本信息 ----
  get_store_info: {
    name: 'get_store_info',
    description: '获取当前门店的基本信息（名称、地址、联系人）',
    async execute({ tenantId }) {
      const store = await storeService.getMyStore(tenantId)
      // 只提取必要字段，不返回内部状态字段
      return {
        name: store.name,
        address: store.address,
        contact_name: store.contact_name,
        contact_phone: store.contact_phone
      }
    }
  },

  // ---- 工具2: 获取店铺历史记忆 ----
  get_store_memory: {
    name: 'get_store_memory',
    description: '获取店铺历史记忆，可按类型过滤（user_decision/shop_attr/sales_data）',
    async execute({ tenantId, type = '' }) {
      const { list } = await memoryService.list(tenantId, { type, pageSize: 50 })
      // 只返回 type/content/importance，剥离 id/tenant_id/deleted 等内部字段
      return list.map(m => ({
        type: m.memory_type,
        content: m.memory_content,
        importance: Number(m.importance)
      }))
    }
  },

  // ---- 工具3: 获取销售数据汇总 ----
  get_sales_summary: {
    name: 'get_sales_summary',
    description: '获取门店销售相关的历史数据记录',
    async execute({ tenantId }) {
      const { list } = await memoryService.list(tenantId, { type: 'sales_data', pageSize: 20 })
      return list.map(m => ({
        content: m.memory_content,
        importance: Number(m.importance)
      }))
    }
  },

  // ---- 工具4: 查询近期对话记录 ----
  get_chat_history: {
    name: 'get_chat_history',
    description: '查询本门店近期的对话记录（最多20条）',
    async execute({ tenantId, limit = 10 }) {
      const safeLimit = Math.min(Number(limit) || 10, 20)
      // 强制 tenant_id 过滤，防止越权
      const [rows] = await pool.query(
        'SELECT user_input, ai_reply, create_time FROM llm_chat_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ?',
        [tenantId, safeLimit]
      )
      return rows
    }
  },

  // ---- 工具5: 查询 Token 使用情况 ----
  get_token_usage: {
    name: 'get_token_usage',
    description: '查询本门店当月的 Token 配额与使用量',
    async execute({ tenantId }) {
      const quota = await require('./token.service').getQuota(tenantId)
      return {
        month: quota.month,
        quota_tokens: quota.quota_tokens,
        used_tokens: quota.used_tokens
      }
    }
  }
}

// 白名单 = 所有已注册工具名
const WHITELIST = Object.keys(TOOLS)

/**
 * 校验工具是否在白名单
 */
function isAllowed(toolName) {
  return Object.prototype.hasOwnProperty.call(TOOLS, toolName)
}

/**
 * 获取工具描述（供 Planner 组装提示词）
 */
function getToolDescriptions() {
  return WHITELIST.map(name => `- ${name}: ${TOOLS[name].description}`).join('\n')
}

/**
 * 执行工具（带白名单 + 租户边界强制）
 * @param {string} toolName 工具名
 * @param {object} args 工具参数（不可含 tenantId 覆盖）
 * @param {object} ctx 上下文，必须含 tenantId（来自JWT）
 * @returns {Promise<any>} 工具执行结果
 */
async function executeTool(toolName, args = {}, ctx = {}) {
  // 白名单校验
  if (!isAllowed(toolName)) {
    throw new AppError(403, `工具 "${toolName}" 不在白名单内，禁止调用`, 403)
  }
  // 租户边界：tenantId 必须来自 JWT 上下文，禁止从 args 注入
  const { tenantId } = ctx
  if (!tenantId || tenantId === -1) {
    throw new AppError(403, '缺少有效租户身份，禁止执行工具', 403)
  }
  // 强制覆盖 args 中的 tenantId，防止 Prompt 注入篡改
  const safeArgs = { ...args, tenantId }
  return TOOLS[toolName].execute(safeArgs)
}

module.exports = { TOOLS, WHITELIST, isAllowed, getToolDescriptions, executeTool }
