-- Additive, repeatable. Run before enabling the new application version.
CREATE TABLE IF NOT EXISTS c_operator_charge_rule (
  tenant_id BIGINT NOT NULL PRIMARY KEY,
  max_charging_hours INT NOT NULL DEFAULT 24,
  whitelist_enabled TINYINT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_operator_hours CHECK (max_charging_hours BETWEEN 1 AND 24),
  CONSTRAINT chk_operator_whitelist CHECK (whitelist_enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_operator_charge_whitelist (
  tenant_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id,member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO c_operator_charge_rule(tenant_id) SELECT id FROM sys_tenant;
INSERT IGNORE INTO c_operator_charge_rule(tenant_id) VALUES(9999);
-- Stable feature IDs; stop on collisions rather than replacing existing menu data.
INSERT INTO sys_menu(menu_id,menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT 3100,'充电规则',2066,20,'chargeRule','operator/chargeRule/index','1','0','C','0','0','operator:chargeRule:query','list','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:chargeRule:query');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT 3101,'充电规则修改',3100,1,'#','1','0','F','0','0','operator:chargeRule:edit','#','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:chargeRule:edit');
-- Global unique username constraint is added by the preflight migration runner,
-- only after reporting duplicate legacy usernames; never merge existing accounts.
