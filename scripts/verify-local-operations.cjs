// 真实本地 HTTP/MySQL 验收；仅创建和清理本次唯一前缀数据，不修改历史订单。
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.OPERATIONS_BASE_URL || 'http://127.0.0.1:38080/';
const run = 'QA_OPS_' + Date.now();
const tenant = 87000000 + crypto.randomInt(1000000), other = tenant + 1000000;
const member = tenant + 2000000, otherMember = tenant + 3000000;
const memberToken = crypto.randomUUID();
const checks = [];
let admin, operator, template, coupon;
function sql(text) { return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=password', 'hcp-mysql', 'mysql', '--default-character-set=utf8mb4', '-uroot', 'vctgo_platform', '-N'], { input: text, encoding: 'utf8' }).trim(); }
function redis(...args) { return execFileSync('docker', ['exec', 'hcp-redis', 'redis-cli', '-n', '5', ...args], { encoding: 'utf8' }).trim(); }
async function req(resource, body, token = admin, extra = {}) {
  const response = await fetch(base + resource, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return response.json();
}
async function api(resource, body, target = tenant, token = admin) {
  return req('operator/operations/' + resource + (body === undefined ? (resource.includes('?') ? '&' : '?') + 'targetTenantId=' + target : ''), body === undefined ? undefined : { ...body, targetTenantId: target }, token);
}
async function ok(resource, body, target, token) { const result = await api(resource, body, target, token); assert.equal(result.code, 200, JSON.stringify(result)); return result.data; }
async function reject(resource, body, target, token) { const result = await api(resource, body, target, token); assert.notEqual(result.code, 200, JSON.stringify(result)); }
function pass(name) { checks.push(name); console.log('PASS ' + name); }
async function login(name = 'admin') {
  const code = await req('code', undefined, null); let value = redis('GET', 'captcha_codes:' + code.uuid); try { value = JSON.parse(value); } catch {}
  const response = await req('auth/login', { username: name, password: 'admin123', uuid: code.uuid, code: value }, null);
  assert.equal(response.code, 200, JSON.stringify(response)); return response.data.access_token;
}
function order(name, amount = 20, owner = member, state = '5') {
  const id = run + '_' + name;
  sql(`INSERT INTO c_charging_order(order_id,order_number,user_id,tenant_id,pile_id,device_type,order_state,charge_status,ordergold,charge_fee,service_fee,refund_amount,consume_power,start_time,end_time,real_end_time,create_time)
    VALUES('${id}','${id}',${owner},${tenant},'${run}',4,'${state}','${state === '1' ? '9001' : '9003'}','${amount}',${amount},0,0,${state === '1' ? 0 : 5},DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s'),${state === '1' ? 'NULL' : "DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')"},${state === '1' ? 'NULL' : 'NOW()'},NOW())`);
  return id;
}
async function main() {
  try {
    admin = await login();
    sql(`INSERT INTO sys_tenant(id,tenant_name,status,del_flag,tenant_time) VALUES(${tenant},'${run}','0','0','2099-12-31'),(${other},'${run}_B','0','0','2099-12-31');
      INSERT INTO c_member(member_id,user_name,tenant_id) VALUES(${member},'${run}',${tenant}),(${otherMember},'${run}_B',${other});
      INSERT INTO c_menber_balance(member_id,tenant_id,amount,version) VALUES(${member},${tenant},1000,1),(${otherMember},${other},1000,1);
      INSERT INTO c_charging_station(station_name,address,region_code,tenant_id) VALUES('${run}','local','QA',${tenant});
      INSERT INTO c_charging_pile(pile_id,name,station_id,tenant_id,device_type,deleted) SELECT '${run}','${run}',station_id,${tenant},4,0 FROM c_charging_station WHERE station_name='${run}';
      INSERT INTO sys_role(role_name,role_key,role_sort,status,tenant_id) VALUES('${run}','${run}',99,'0',${tenant});
      INSERT INTO sys_role_menu(role_id,menu_id,tenant_id) SELECT r.role_id,m.menu_id,${tenant} FROM sys_role r JOIN sys_menu m ON m.perms LIKE 'operator:operations:%' OR m.path='operations' WHERE r.role_key='${run}';
      INSERT INTO sys_user(user_name,nick_name,password,status,del_flag,tenant_id) SELECT '${run}','${run}',password,'0','0',${tenant} FROM sys_user WHERE user_id=1;
      INSERT INTO sys_user_role(user_id,role_id,tenant_id) SELECT u.user_id,r.role_id,${tenant} FROM sys_user u JOIN sys_role r ON r.role_key='${run}' WHERE u.user_name='${run}';`);
    operator = await login(run);
    redis('SET', 'member:token:' + memberToken, String(member), 'EX', '3600');
    const normal = order('paid'), second = order('coupon-race'), historic = order('historic'), low = order('low', 2000), uncertain = order('uncertain', 0, member, '1');
    sql(`UPDATE c_charging_order SET stop_reason='设备启动结果待确认' WHERE order_id='${uncertain}'`);
    await ok('overview'); await ok('orders'); await ok('finance'); await ok('coupons');
    pass('overview, orders, finance, coupon queries run against MySQL');
    await reject('overview', undefined, other, operator);
    await reject('orders/' + normal, undefined, other);
    assert.notEqual((await req('operator/operations/finance', undefined, null)).code, 200);
    pass('unauthenticated and cross-tenant reads rejected');
    const date = new Date(); const before = new Date(date.getTime() - 86400000).toLocaleString('sv-SE'); const after = new Date(date.getTime() + 86400000).toLocaleString('sv-SE');
    await ok('coupon', { name: run, thresholdAmount: 20, discountAmount: 5, validFrom: before, validTo: after, totalCount: 1 });
    template = Number(sql(`SELECT id FROM c_local_coupon_template WHERE tenant_id=${tenant} ORDER BY id DESC LIMIT 1`));
    coupon = (await ok('coupon/issue', { templateId: template, memberId: member, requestId: run + '_issue' })).id;
    assert.equal((await ok('coupon/issue', { templateId: template, memberId: member, requestId: run + '_issue' })).id, coupon);
    await reject('coupon/issue', { templateId: template, memberId: member, requestId: run + '_over' });
    await reject('coupon/issue', { templateId: template, memberId: otherMember, requestId: run + '_foreign' });
    pass('coupon issue replay, quota and member tenant validation');
    const results = await Promise.all(Array.from({ length: 8 }, () => ok('pay', { orderId: normal, couponId: coupon, requestId: run + '_pay' })));
    assert.equal(new Set(results.map(row => row.id)).size, 1);
    assert.equal(Number(sql(`SELECT amount FROM c_menber_balance WHERE member_id=${member}`)), 985);
    assert.equal(sql(`SELECT COUNT(*) FROM c_member_balance_ledger WHERE member_id=${member} AND type='LOCAL_PAYMENT'`), '1');
    pass('eight concurrent duplicate payments debit exactly once with coupon');
    await reject('pay', { orderId: second, couponId: coupon, requestId: run + '_reuse' });
    await reject('pay', { orderId: low, requestId: run + '_low' });
    await reject('refund', { orderId: historic, requestId: run + '_historic', amount: 1, reason: 'no payment' });
    pass('reused coupon, insufficient balance and unpaid-history refund rejected');
    await ok('split', { orderId: normal }); await ok('split', { orderId: normal });
    const refundRequest = { orderId: normal, requestId: run + '_refund', amount: 5, reason: 'partial refund' };
    const refunds = await Promise.all(Array.from({ length: 8 }, () => ok('refund', refundRequest)));
    assert.equal(new Set(refunds.map(row => row.id)).size, 1);
    assert.equal(Number(sql(`SELECT amount FROM c_menber_balance WHERE member_id=${member}`)), 990);
    await ok('refund', { orderId: normal, requestId: run + '_rest', amount: 10, reason: 'remaining refund' });
    assert.equal(Number(sql(`SELECT amount FROM c_menber_balance WHERE member_id=${member}`)), 1000);
    assert.equal(sql(`SELECT status FROM c_local_coupon WHERE id=${coupon}`), 'UNUSED');
    assert.equal(Number(sql(`SELECT SUM(platform_amount+station_amount) FROM c_local_split WHERE payment_id=${results[0].id}`)), 0);
    assert.equal(sql(`SELECT COUNT(*) FROM c_local_split WHERE payment_id=${results[0].id}`), '3');
    await reject('refund', { orderId: normal, requestId: run + '_extra', amount: 1, reason: 'over refund' });
    pass('concurrent partial refunds, full refund, coupon restoration and split reversals balance');
    // 一张券在两笔订单上并发核销，只能成功一笔。
    const raceA = order('raceA'), raceB = order('raceB');
    const race = await Promise.all([api('pay', { orderId: raceA, couponId: coupon, requestId: run + '_raceA' }), api('pay', { orderId: raceB, couponId: coupon, requestId: run + '_raceB' })]);
    assert.equal(race.filter(row => row.code === 200).length, 1);
    pass('same coupon concurrent use across orders succeeds once');
    await reject('exception/action', { orderId: uncertain, action: 'CANCEL', reason: 'unsafe' });
    await ok('exception/action', { orderId: uncertain, action: 'NOTE', reason: 'await verification' });
    const exceptions = await ok('orders?exceptions=true'); assert(exceptions.records.some(row => row.order_id === uncertain));
    pass('uncertain order cannot be cancelled or hidden by notes');
    const reserved = order('reserved', 0, member, '1');
    await reject('exception/action', { orderId: reserved, action: 'CANCEL', reason: 'no confirmed startup failure' });
    assert.equal(sql(`SELECT order_state FROM c_charging_order WHERE order_id='${reserved}'`), '1');
    const legacy = order('completedLegacy', 1, member, '3');
    await ok('pay', { orderId: legacy, requestId: run + '_legacy' });
    pass('unconfirmed reservation remains active; completed legacy state supports explicit local payment');
    const mini = await req('hcp-mp/local/orders/' + historic, undefined, null, { token: 'Bearer ' + memberToken });
    assert.equal(mini.code, 200, JSON.stringify(mini));
    const spoof = await req('hcp-mp/local/orders/pay', { orderId: historic, memberId: otherMember, requestId: run + '_mini' }, null, { token: 'Bearer ' + memberToken });
    assert.equal(spoof.code, 200, JSON.stringify(spoof));
    assert.equal(sql(`SELECT member_id FROM c_local_payment WHERE order_id='${historic}'`), String(member));
    pass('mini payment takes member identity from token instead of submitted memberId');
    const day = new Date().toLocaleDateString('sv-SE'); const reconcile = await ok('reconcile', { businessDay: day });
    assert.equal(reconcile.differences, 0, JSON.stringify(reconcile));
    pass('local payment, refund, wallet and split reconciliation has zero differences');
    // 验证末端流水失败时付款和余额一并回滚。
    const broken = order('rollback');
    sql(`DELIMITER //
CREATE TRIGGER ${run}_fail BEFORE INSERT ON c_member_balance_ledger FOR EACH ROW BEGIN IF NEW.member_id=${member} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated rollback probe'; END IF; END//
DELIMITER ;`);
    const beforeBalance = sql(`SELECT amount FROM c_menber_balance WHERE member_id=${member}`);
    await reject('pay', { orderId: broken, requestId: run + '_rollback' });
    assert.equal(sql(`SELECT COUNT(*) FROM c_local_payment WHERE order_id='${broken}'`), '0');
    assert.equal(sql(`SELECT amount FROM c_menber_balance WHERE member_id=${member}`), beforeBalance);
    sql(`DROP TRIGGER ${run}_fail`);
    pass('terminal ledger failure rolls payment and wallet mutation back');
  } finally {
    sql(`DROP TRIGGER IF EXISTS ${run}_fail;
      DELETE FROM c_local_reconcile_note WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_reconcile WHERE tenant_id IN (${tenant},${other});
      DELETE FROM c_local_split WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_refund WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_payment WHERE tenant_id IN (${tenant},${other});
      DELETE FROM c_local_coupon WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_coupon_template WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_split_rule WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_local_exception_log WHERE tenant_id IN (${tenant},${other});
      DELETE FROM c_member_balance_ledger WHERE member_id IN (${member},${otherMember}); DELETE FROM c_charging_order WHERE tenant_id IN (${tenant},${other}); DELETE FROM c_charging_pile WHERE pile_id='${run}'; DELETE FROM c_charging_station WHERE station_name='${run}';
      DELETE FROM c_menber_balance WHERE member_id IN (${member},${otherMember}); DELETE FROM c_member WHERE member_id IN (${member},${otherMember});
      DELETE FROM sys_role_menu WHERE role_id IN (SELECT role_id FROM sys_role WHERE role_key='${run}'); DELETE FROM sys_user_role WHERE user_id IN (SELECT user_id FROM sys_user WHERE user_name='${run}'); DELETE FROM sys_user WHERE user_name='${run}'; DELETE FROM sys_role WHERE role_key='${run}'; DELETE FROM sys_tenant WHERE id IN (${tenant},${other});`);
    redis('DEL', 'member:token:' + memberToken);
    fs.mkdirSync(path.join(__dirname, '../outputs/local-operations'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../outputs/local-operations', run + '.json'), JSON.stringify({ run, checks, count: checks.length, scope: 'Local real HTTP and MySQL, isolated fixtures cleaned', finishedAt: new Date().toISOString() }, null, 2));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
