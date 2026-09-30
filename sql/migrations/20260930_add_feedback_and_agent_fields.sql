-- ============================================================
-- 数据库增量迁移脚本
-- 版本: 20260930
-- 变更内容:
--   1. 新增对话反馈表 chat_feedback
--   2. llm_chat_log 表新增 5 个 Agent 运行时字段: plan, rounds, aborted, abort_reason, elapsed_ms
-- 兼容: MySQL 5.7+
-- 幂等: 支持重复执行，不删除原有表和数据
-- 执行: mysql -u shop_user -pShop@123456 shop_agent_db < sql/migrations/20260930_add_feedback_and_agent_fields.sql
-- ============================================================

USE shop_agent_db;

-- ============================================================
-- 变更 1: 新增对话反馈表 chat_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_feedback (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     BIGINT       NOT NULL,
  user_id       BIGINT       NOT NULL,
  chat_log_id   BIGINT       NOT NULL COMMENT '关联 llm_chat_log.id',
  feedback      TINYINT      NOT NULL COMMENT '1=点赞 -1=踩 0=取消',
  comment       VARCHAR(500) DEFAULT NULL COMMENT '可选备注',
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_chat (user_id, chat_log_id),
  KEY idx_tenant (tenant_id),
  KEY idx_feedback (feedback)
) ENGINE=InnoDB COMMENT='对话反馈表';

-- ============================================================
-- 变更 2: llm_chat_log 新增 Agent 运行时字段
-- 每个字段独立判断是否存在，不存在则添加（幂等）
-- ============================================================

-- 2.1 plan: Planner 规划步骤（JSON 字符串）
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'llm_chat_log'
    AND COLUMN_NAME = 'plan'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE llm_chat_log ADD COLUMN plan MEDIUMTEXT DEFAULT NULL COMMENT ''Planner规划步骤(JSON)'' AFTER ai_reply',
  'SELECT ''column plan already exists, skip'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 rounds: 实际工具调用轮次
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'llm_chat_log'
    AND COLUMN_NAME = 'rounds'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE llm_chat_log ADD COLUMN rounds INT NOT NULL DEFAULT 0 COMMENT ''实际工具调用轮次'' AFTER plan',
  'SELECT ''column rounds already exists, skip'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.3 aborted: 是否被运行时限制中止
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'llm_chat_log'
    AND COLUMN_NAME = 'aborted'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE llm_chat_log ADD COLUMN aborted TINYINT NOT NULL DEFAULT 0 COMMENT ''是否被运行时限制中止 0否 1是'' AFTER rounds',
  'SELECT ''column aborted already exists, skip'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.4 abort_reason: 中止原因
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'llm_chat_log'
    AND COLUMN_NAME = 'abort_reason'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE llm_chat_log ADD COLUMN abort_reason VARCHAR(500) DEFAULT NULL COMMENT ''中止原因'' AFTER aborted',
  'SELECT ''column abort_reason already exists, skip'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.5 elapsed_ms: 任务耗时(毫秒)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'llm_chat_log'
    AND COLUMN_NAME = 'elapsed_ms'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE llm_chat_log ADD COLUMN elapsed_ms INT NOT NULL DEFAULT 0 COMMENT ''任务耗时(毫秒)'' AFTER abort_reason',
  'SELECT ''column elapsed_ms already exists, skip'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 验证: 输出表结构确认
-- ============================================================
SELECT 'llm_chat_log columns:' AS info;
SHOW COLUMNS FROM llm_chat_log;

SELECT 'chat_feedback columns:' AS info;
SHOW COLUMNS FROM chat_feedback;
