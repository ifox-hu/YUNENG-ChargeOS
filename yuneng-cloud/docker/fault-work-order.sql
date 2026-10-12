-- Additive, repeatable migration. MySQL 8.0; never drops existing business data.
CREATE TABLE IF NOT EXISTS c_fault_ticket (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 ticket_no VARCHAR(40) NOT NULL UNIQUE,
 pile_id VARCHAR(64) NOT NULL,
 tenant_id BIGINT NOT NULL,
 fault_type VARCHAR(24) NOT NULL,
 priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
 source VARCHAR(16) NOT NULL,
 description VARCHAR(1000) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'NEW',
 assignee_id BIGINT NULL,
 assignee_name VARCHAR(64) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at DATETIME NULL,
 closed_at DATETIME NULL,
 active_key VARCHAR(120) GENERATED ALWAYS AS
   (CASE WHEN status <> 'CLOSED' THEN CONCAT(pile_id, ':', fault_type) ELSE NULL END) STORED,
 UNIQUE KEY uk_fault_active (active_key),
 KEY idx_ticket_scope (tenant_id,status,created_at),
 KEY idx_ticket_pile (pile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_fault_report (
 ticket_id BIGINT NOT NULL,
 member_id BIGINT NOT NULL,
 description VARCHAR(1000) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(ticket_id,member_id),
 KEY idx_report_member(member_id,created_at),
 FOREIGN KEY(ticket_id) REFERENCES c_fault_ticket(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_fault_ticket_log (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 ticket_id BIGINT NOT NULL,
 action VARCHAR(24) NOT NULL,
 from_status VARCHAR(16) NULL,
 to_status VARCHAR(16) NOT NULL,
 actor_type VARCHAR(16) NOT NULL,
 actor_id BIGINT NOT NULL,
 actor_name VARCHAR(64) NOT NULL,
 note VARCHAR(1000) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_log_ticket(ticket_id,id),
 FOREIGN KEY(ticket_id) REFERENCES c_fault_ticket(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_device_alarm (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 event_id VARCHAR(64) NOT NULL UNIQUE,
 ticket_id BIGINT NOT NULL,
 pile_id VARCHAR(64) NOT NULL,
 fault_type VARCHAR(24) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES c_fault_ticket(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @parent=(SELECT menu_id FROM sys_menu WHERE path='operator' AND menu_type='M' LIMIT 1);
SET @parent=COALESCE(@parent,(SELECT parent_id FROM sys_menu WHERE component='operator/pile/index' LIMIT 1),0);
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '故障工单',@parent,20,'fault','operator/fault/index',1,0,'C','0','0','operator:fault:list','tool','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:list');
SET @fault_menu=(SELECT menu_id FROM sys_menu WHERE perms='operator:fault:list' LIMIT 1);
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type,visible,status,perms,create_time)
SELECT '告警模拟',@fault_menu,1,'#','F','0','0','operator:fault:add',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:add');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type,visible,status,perms,create_time)
SELECT '分配工单',@fault_menu,2,'#','F','0','0','operator:fault:assign',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:assign');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type,visible,status,perms,create_time)
SELECT '处理工单',@fault_menu,3,'#','F','0','0','operator:fault:handle',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:handle');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type,visible,status,perms,create_time)
SELECT '关闭工单',@fault_menu,4,'#','F','0','0','operator:fault:close',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:fault:close');

