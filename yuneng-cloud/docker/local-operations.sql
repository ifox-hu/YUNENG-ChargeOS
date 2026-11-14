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

-- 将独立工作台权限迁移到原页面；保留权限键、角色授权和业务数据，可重复执行。
START TRANSACTION;
SET @report_menu=(SELECT menu_id FROM sys_menu WHERE component='total/manager/index' LIMIT 1);
SET @order_menu=(SELECT menu_id FROM sys_menu WHERE component='operator/order/index' LIMIT 1);
SET @balance_menu=(SELECT menu_id FROM sys_menu WHERE component='operator/balance/index' LIMIT 1);
SET @member_menu=(SELECT menu_id FROM sys_menu WHERE component='operator/member/index' LIMIT 1);

INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '经营概览',@report_menu,10,'',1,0,'F','0','0','operator:operations:view','#','admin',NOW()
WHERE @report_menu IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:view');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '异常核查与订单资金',@order_menu,10,'',1,0,'F','0','0','operator:operations:orders','#','admin',NOW()
WHERE @order_menu IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:orders');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '收款与对账',@balance_menu,10,'',1,0,'F','0','0','operator:operations:finance','#','admin',NOW()
WHERE @balance_menu IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:finance');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '优惠券',@member_menu,10,'',1,0,'F','0','0','operator:operations:marketing','#','admin',NOW()
WHERE @member_menu IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:marketing');
INSERT INTO sys_menu(menu_name,parent_id,order_num,path,is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time)
SELECT '本地运营操作',@order_menu,11,'',1,0,'F','0','0','operator:operations:write','#','admin',NOW()
WHERE @order_menu IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sys_menu WHERE perms='operator:operations:write');

UPDATE sys_menu SET parent_id=CASE perms
 WHEN 'operator:operations:view' THEN @report_menu
 WHEN 'operator:operations:orders' THEN @order_menu
 WHEN 'operator:operations:finance' THEN @balance_menu
 WHEN 'operator:operations:marketing' THEN @member_menu
 WHEN 'operator:operations:write' THEN @order_menu END,
 menu_name=CASE perms WHEN 'operator:operations:view' THEN '经营概览'
 WHEN 'operator:operations:orders' THEN '异常核查与订单资金'
 WHEN 'operator:operations:finance' THEN '收款与对账'
 WHEN 'operator:operations:marketing' THEN '优惠券' ELSE '本地运营操作' END,
 menu_type='F',path='',component=NULL,visible='0',status='0',icon='#'
WHERE perms IN ('operator:operations:view','operator:operations:orders','operator:operations:finance','operator:operations:marketing','operator:operations:write')
 AND @report_menu IS NOT NULL AND @order_menu IS NOT NULL AND @balance_menu IS NOT NULL AND @member_menu IS NOT NULL;

-- 保留旧页面角色的访问入口，仅补齐其已有权限所在的页面和目录，不新增写权限。
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
SELECT DISTINCT rm.role_id,m.parent_id FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id
WHERE m.perms IN ('operator:operations:view','operator:operations:orders','operator:operations:finance','operator:operations:marketing');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
SELECT DISTINCT rm.role_id,m.parent_id FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id
WHERE m.menu_id IN (@report_menu,@order_menu,@balance_menu,@member_menu) AND m.parent_id>0;

-- 空的旧目录删除；若存在自定义子菜单则仅隐藏，避免误删扩展。
SET @old_root=(SELECT menu_id FROM sys_menu WHERE parent_id=0 AND path='operations' LIMIT 1);
UPDATE sys_menu SET visible='1',status='1' WHERE menu_id=@old_root;
DELETE rm FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id
WHERE m.menu_id=@old_root AND NOT EXISTS(SELECT 1 FROM (SELECT parent_id FROM sys_menu) children WHERE children.parent_id=@old_root);
DELETE FROM sys_menu WHERE menu_id=@old_root AND NOT EXISTS(SELECT 1 FROM (SELECT parent_id FROM sys_menu) children WHERE children.parent_id=@old_root);
COMMIT;
