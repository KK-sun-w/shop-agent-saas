-- ============================================================
-- 门店AI Agent SaaS 数据库初始化脚本
-- 数据库: shop_agent_db
-- 账号: shop_user / Shop@123456
-- ============================================================

CREATE DATABASE IF NOT EXISTS shop_agent_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE shop_agent_db;

-- ---- 租户（门店）----
DROP TABLE IF EXISTS tenant;
CREATE TABLE tenant (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL COMMENT '门店名称',
  contact_name  VARCHAR(50)  DEFAULT NULL COMMENT '联系人',
  contact_phone VARCHAR(30)  DEFAULT NULL COMMENT '联系电话',
  address       VARCHAR(255) DEFAULT NULL COMMENT '门店地址',
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='租户/门店';

-- ---- 租户用户（含创始人管理员）----
DROP TABLE IF EXISTS tenant_user;
CREATE TABLE tenant_user (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     BIGINT       NOT NULL COMMENT '租户ID, 创始人管理员为-1',
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name     VARCHAR(50)  DEFAULT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'owner' COMMENT 'admin创始人/owner店主/staff店员',
  status        TINYINT      NOT NULL DEFAULT 1,
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username),
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB COMMENT='租户用户';

-- ---- 店铺记忆（历史决策 + 店铺属性）----
DROP TABLE IF EXISTS shop_memory;
CREATE TABLE shop_memory (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id      BIGINT       NOT NULL,
  memory_type    VARCHAR(30)  NOT NULL COMMENT 'user_decision/shop_attr/sales_data',
  memory_content TEXT         NOT NULL COMMENT 'JSON 或纯文本',
  importance     DECIMAL(3,1) NOT NULL DEFAULT 5.0 COMMENT '权重1-10',
  source         VARCHAR(30)  NOT NULL DEFAULT 'user_chat' COMMENT '来源',
  deleted        TINYINT      NOT NULL DEFAULT 0,
  create_time    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tenant_type (tenant_id, memory_type, deleted)
) ENGINE=InnoDB COMMENT='店铺长期记忆';

-- ---- LLM 问答记录 ----
DROP TABLE IF EXISTS llm_chat_log;
CREATE TABLE llm_chat_log (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     BIGINT       NOT NULL,
  user_id       BIGINT       NOT NULL,
  agent_type    VARCHAR(30)  NOT NULL COMMENT 'mentor/memory/...',
  user_input    TEXT         NOT NULL,
  ai_reply      MEDIUMTEXT   DEFAULT NULL,
  plan          MEDIUMTEXT   DEFAULT NULL COMMENT 'Planner规划步骤(JSON)',
  rounds        INT          NOT NULL DEFAULT 0 COMMENT '实际工具调用轮次',
  aborted       TINYINT      NOT NULL DEFAULT 0 COMMENT '是否被运行时限制中止 0否 1是',
  abort_reason  VARCHAR(500) DEFAULT NULL COMMENT '中止原因',
  elapsed_ms    INT          NOT NULL DEFAULT 0 COMMENT '任务耗时(毫秒)',
  prompt_tokens INT          DEFAULT 0,
  reply_tokens  INT          DEFAULT 0,
  total_tokens  INT          DEFAULT 0,
  cost_amount   DECIMAL(12,6) DEFAULT 0 COMMENT '消耗金额',
  status        VARCHAR(20)  NOT NULL DEFAULT 'success',
  error_msg     VARCHAR(500) DEFAULT NULL,
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_time (tenant_id, create_time),
  KEY idx_user (user_id)
) ENGINE=InnoDB COMMENT='LLM问答记录';

-- ---- Token 消耗日志（每次LLM调用一条）----
DROP TABLE IF EXISTS token_usage_log;
CREATE TABLE token_usage_log (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     BIGINT       NOT NULL,
  user_id       BIGINT       NOT NULL,
  chat_log_id   BIGINT       DEFAULT NULL,
  agent_type    VARCHAR(30)  NOT NULL,
  prompt_tokens INT          NOT NULL DEFAULT 0,
  reply_tokens  INT          NOT NULL DEFAULT 0,
  total_tokens  INT          NOT NULL DEFAULT 0,
  model         VARCHAR(50)  DEFAULT NULL,
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_time (tenant_id, create_time)
) ENGINE=InnoDB COMMENT='Token消耗日志';

-- ---- 租户 Token 月度配额 ----
DROP TABLE IF EXISTS token_quota;
CREATE TABLE token_quota (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     BIGINT       NOT NULL,
  month         VARCHAR(7)   NOT NULL COMMENT 'YYYY-MM',
  quota_tokens  BIGINT       NOT NULL DEFAULT 1000000,
  used_tokens   BIGINT       NOT NULL DEFAULT 0,
  UNIQUE KEY uk_tenant_month (tenant_id, month)
) ENGINE=InnoDB COMMENT='Token月度配额';

-- ---- 对话反馈（点赞/踩）----
DROP TABLE IF EXISTS chat_feedback;
CREATE TABLE chat_feedback (
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
-- 初始化数据
-- ============================================================

-- 创始人管理员: admin / Admin@123456
INSERT INTO tenant_user (tenant_id, username, password_hash, real_name, role)
VALUES (-1, 'admin',
  '$2a$10$tqrFja2qq/F9u6NLFE41keUJCIMFdWumrK9.DmCOgMlfhuwjHQ.bK',
  '超级管理员', 'admin');

-- 演示门店
INSERT INTO tenant (name, contact_name, contact_phone, address)
VALUES ('鲜果时光便利店', '张老板', '13800000001', '北京市朝阳区xx路1号');

-- 演示店主: demo / Demo@123456
INSERT INTO tenant_user (tenant_id, username, password_hash, real_name, role)
VALUES (1, 'demo',
  '$2a$10$G4E/psvuvISUnZfJW0VxrOqrna9ae0nG6vuLlW/Psbs7FK3UI./T.',
  '张老板', 'owner');

-- 演示门店记忆
INSERT INTO shop_memory (tenant_id, memory_type, memory_content, importance, source)
VALUES
 (1, 'shop_attr', '{"text":"主营生鲜水果，目标客群为周边社区居民"}', 8, 'init'),
 (1, 'user_decision', '{"decision":"只从ABC供应商进货水果"}', 9, 'init');
