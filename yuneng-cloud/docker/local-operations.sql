-- 本地运营业务：仅新增表，不把历史结算订单回填为已收款。
CREATE TABLE IF NOT EXISTS c_local_payment (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, order_id VARCHAR(64) NOT NULL,
 member_id BIGINT NOT NULL, station_id BIGINT NULL, request_id VARCHAR(80) NOT NULL,
 gross_amount DECIMAL(18,2) NOT NULL, discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
 paid_amount DECIMAL(18,2) NOT NULL, refunded_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
 coupon_id BIGINT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PAID',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_local_payment_order(order_id), UNIQUE KEY uk_local_payment_request(tenant_id,request_id),
 KEY idx_local_payment_tenant_time(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_refund (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, payment_id BIGINT NOT NULL,
 request_id VARCHAR(80) NOT NULL, amount DECIMAL(18,2) NOT NULL, reason VARCHAR(255) NOT NULL,
 actor_id BIGINT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_local_refund_request(tenant_id,request_id), KEY idx_local_refund_payment(payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_split_rule (
 tenant_id BIGINT PRIMARY KEY, platform_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00, version INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_split (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, payment_id BIGINT NOT NULL,
 refund_id BIGINT NOT NULL DEFAULT 0, station_id BIGINT NULL, platform_rate DECIMAL(5,2) NOT NULL,
 platform_amount DECIMAL(18,2) NOT NULL, station_amount DECIMAL(18,2) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_local_split_event(payment_id,refund_id), KEY idx_local_split_tenant_time(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_reconcile (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, business_day DATE NOT NULL,
 checked_count INT NOT NULL, difference_count INT NOT NULL, excluded_count INT NOT NULL,
 details MEDIUMTEXT NOT NULL, actor_id BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_local_reconcile_tenant(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_reconcile_note (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, batch_id BIGINT NOT NULL,
 note VARCHAR(255) NOT NULL, actor_id BIGINT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_exception_log (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, order_id VARCHAR(64) NOT NULL,
 action VARCHAR(20) NOT NULL, note VARCHAR(255) NOT NULL, actor_id BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_local_exception_order(tenant_id,order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_coupon_template (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, name VARCHAR(60) NOT NULL,
 threshold_amount DECIMAL(18,2) NOT NULL, discount_amount DECIMAL(18,2) NOT NULL,
 valid_from DATETIME NOT NULL, valid_to DATETIME NOT NULL, total_count INT NOT NULL,
 issued_count INT NOT NULL DEFAULT 0, enabled TINYINT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_local_coupon_template_tenant(tenant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS c_local_coupon (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, tenant_id BIGINT NOT NULL, template_id BIGINT NOT NULL,
 member_id BIGINT NOT NULL, request_id VARCHAR(80) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'UNUSED',
 used_order_id VARCHAR(64) NULL, issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_local_coupon_issue(tenant_id,request_id), KEY idx_local_coupon_member(tenant_id,member_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 菜单与权限；保留原经营报表。新增页面对具有相应权限的角色可见。
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '运营工作台',0,2,'operations',NULL,1,0,'M','0','0','','dashboard','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE parent_id=0 AND path='operations');
SET @operations_parent=(SELECT menu_id FROM sys_menu WHERE parent_id=0 AND path='operations' LIMIT 1);
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '经营仪表盘',@operations_parent,1,'overview','operator/operations/overview',1,0,'C','0','0','operator:operations:view','chart','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:view');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '订单与异常',@operations_parent,2,'orders','operator/operations/orders',1,0,'C','0','0','operator:operations:orders','list','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:orders');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '本地财务',@operations_parent,3,'finance','operator/operations/finance',1,0,'C','0','0','operator:operations:finance','money','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:finance');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,component,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '优惠券营销',@operations_parent,4,'marketing','operator/operations/marketing',1,0,'C','0','0','operator:operations:marketing','gift','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:marketing');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '本地运营操作',@operations_parent,9,'',1,0,'F','0','0','operator:operations:write','#','admin',NOW()
WHERE NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:write');
