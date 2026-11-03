-- Additive and repeatable. Run after fault-work-order.sql; never resets business tables.
CREATE TABLE IF NOT EXISTS c_device_alarm_event (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 tenant_id BIGINT NOT NULL,
 event_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
 pile_id VARCHAR(64) NOT NULL,
 fault_type VARCHAR(24) NOT NULL,
 priority VARCHAR(16) NOT NULL,
 description VARCHAR(1000) NOT NULL,
 occurred_at VARCHAR(32) NOT NULL,
 actor_id BIGINT NOT NULL,
 actor_name VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 publish_attempts INT NOT NULL DEFAULT 0,
 consume_failures INT NOT NULL DEFAULT 0,
 replay_generation BIGINT NOT NULL DEFAULT 0,
 lease_token VARCHAR(36) NULL,
 next_retry_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 last_error VARCHAR(500) NULL,
 message_id VARCHAR(128) NULL,
 ticket_id BIGINT NULL,
 received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 processed_at DATETIME(3) NULL,
 UNIQUE KEY uk_alarm_source (tenant_id,event_id),
 KEY idx_alarm_retry (status,next_retry_at,id),
 KEY idx_alarm_tenant (tenant_id,id),
 KEY idx_alarm_device (pile_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Upgrade existing alarm installations without resetting events or replay history.
SET @alarm_generation_ddl=IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='c_device_alarm_event' AND column_name='replay_generation'),'SELECT 1','ALTER TABLE c_device_alarm_event ADD COLUMN replay_generation BIGINT NOT NULL DEFAULT 0 AFTER consume_failures');
PREPARE alarm_generation_stmt FROM @alarm_generation_ddl;
EXECUTE alarm_generation_stmt;
DEALLOCATE PREPARE alarm_generation_stmt;
CREATE TABLE IF NOT EXISTS c_device_alarm_event_audit (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 event_pk BIGINT NOT NULL,
 actor_id BIGINT NOT NULL,
 action VARCHAR(24) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_alarm_audit (event_pk,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @alarm_parent=(SELECT menu_id FROM sys_menu WHERE perms='operator:fault:list' LIMIT 1);
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type,visible,status,perms,create_time)
SELECT '失败告警重放',@alarm_parent,5,'#','F','0','0','operator:fault:alarm-replay',NOW()
WHERE @alarm_parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:alarm-replay');
