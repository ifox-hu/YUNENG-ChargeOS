// Real local integration tests. Disposable members/devices only; no application changes.
// node scripts/test-resume-last-three.cjs [validation|simulator] [orders=1000] [workers=20]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const mode = process.argv[2] || 'validation';
const count = Number(process.argv[3] || 1000), workers = Number(process.argv[4] || 20);
assert(['validation', 'simulator'].includes(mode));
assert(Number.isInteger(count) && count > 0 && count <= 1000);
assert(Number.isInteger(workers) && workers > 0 && workers <= 25);
const run = 'QA3-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
const memberId = 800000000 + crypto.randomInt(90000000), token = crypto.randomUUID();
const out = path.join(__dirname, '../outputs/resume-benchmarks/last-three-20261102');
fs.mkdirSync(out, { recursive: true });
const reportFile = path.join(out, run + '-' + mode + '.json');
const report = { run, mode, count, workers, startedAt: new Date().toISOString(), checks: [], orders: [],
  scope: 'Local real HTTP /mp -> operator -> simulator -> settlement -> DB; not real hardware, not a capacity benchmark',
  restartScope: 'Simulator device instance stop/start and startup recovery policy, not container/process crash recovery' };
const piles = [], online = new Set();
const pause = ms => new Promise(r => setTimeout(r, ms));
function save() { fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); }
function sql(query) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=password', 'hcp-mysql', 'mysql',
    '--default-character-set=utf8mb4', '-uroot', '--batch', '--skip-column-names', 'vctgo_platform'],
    { input: query, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
}
function redis(...args) { return execFileSync('docker', ['exec', 'hcp-redis', 'redis-cli', '-n', '5', ...args], { encoding: 'utf8' }).trim(); }
function check(name, evidence = {}) {
  report.checks.push({ name, ...evidence }); save(); console.log('PASS ' + name + ' ' + JSON.stringify(evidence));
}
async function req(port, route, params = {}, headers = {}) {
  const r = await fetch('http://127.0.0.1:' + port + '/' + route + '?' + new URLSearchParams(params),
    { headers, signal: AbortSignal.timeout(30000) });
  const data = await r.json(); return { http: r.status, ...data };
}
async function ok(port, route, params = {}, headers = {}) {
  const r = await req(port, route, params, headers);
  assert.equal(r.http, 200, JSON.stringify(r)); assert.equal(r.code, 200, JSON.stringify(r)); return r.data;
}
const sim = (route, pile) => ok(39208, 'evcs/sim/v1/' + route, { pileId: pile });
const mp = (route, params) => ok(38080, 'hcp-mp/order/' + route, params, { token: 'Bearer ' + token });
async function waitFor(name, read, predicate, timeout = 25000) {
  const deadline = performance.now() + timeout; let value;
  do { value = await read(); if (predicate(value)) return value; await pause(600); } while (performance.now() < deadline);
  throw new Error(name + ' timed out: ' + JSON.stringify(value));
}
function seed(n) {
  // Fixed template is read-only. Every mutable fixture is uniquely named for this run.
  assert.equal(sql("SELECT COUNT(*) FROM c_charging_pile WHERE pile_id='202312121'"), '1');
  sql(`INSERT INTO c_member(member_id,user_name,tenant_id) VALUES(${memberId},'${run}',9999)`);
  redis('SET', 'member:token:' + token, String(memberId), 'EX', '7200');
  for (let i = 0; i < n; i++) {
    const pile = run + '-' + i;
    piles.push(pile);
    sql(`INSERT INTO c_charging_pile(pile_id,name,device_type,pile_type,tenant_id,running_status,deleted,station_id,user_id,electricity,voltage,max_power,wx_rule_id,cp_fee_type,remark)
      SELECT '${pile}','${run}',4,1,9999,1,0,station_id,user_id,electricity,voltage,max_power,wx_rule_id,cp_fee_type,'${run}'
      FROM c_charging_pile WHERE pile_id='202312121';
      INSERT INTO c_charging_port(pile_id,device_id,name,tenant_id,state,can_use,gun_status)
      VALUES('${pile}','1','${run}',9999,'N',0,0);`);
  }
  return piles.map(pile => ({ pile, portId: sql(`SELECT port_id FROM c_charging_port WHERE pile_id='${pile}'`) }));
}
function rawOrder(id, pile, number = id) {
  sql(`INSERT INTO c_charging_order(order_id,order_number,pile_id,port_id,user_id,tenant_id,order_state,charge_status,start_time)
    SELECT '${id}','${number}','${pile}',port_id,${memberId},9999,'1','9001',DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')
    FROM c_charging_port WHERE pile_id='${pile}'`);
}
async function validation() {
  const [{ pile }] = seed(1);
  const base = { pileId: pile, port: '1', userId: String(memberId), amount: '50', hour: '1' };
  const cases = [
    ['parameter.hours.minimum', { hour: '0' }, '', '时长或金额无效'],
    ['parameter.hours.maximum', { hour: '25' }, '', '时长或金额无效'],
    ['parameter.nonnegative.amount', { amount: '-1' }, '', '时长或金额无效'],
    ['parameter.positive.member', { userId: '0' }, '', '充电用户'],
    ['member.exists', { userId: '99999999' }, '', '充电用户不存在'],
    ['member.tenant.ownership', {}, `UPDATE c_member SET tenant_id=8888 WHERE member_id=${memberId}`, '无权使用'],
    ['device.not.deleted', {}, `UPDATE c_charging_pile SET deleted=1 WHERE pile_id='${pile}'`, '已删除'],
    ['device.not.faulted', {}, `UPDATE c_charging_port SET state='F' WHERE pile_id='${pile}'`, '端口忙碌'],
    ['device.not.disabled', {}, `UPDATE c_charging_port SET can_use=1 WHERE pile_id='${pile}'`, '端口忙碌'],
    ['device.gun.available', {}, `UPDATE c_charging_port SET gun_status=1 WHERE pile_id='${pile}'`, '端口忙碌'],
    ['device.hardware.online', {}, `UPDATE c_charging_pile SET device_type=1,running_status=1 WHERE pile_id='${pile}'`, '设备离线'],
    ['active.order.excluded', {}, 'ACTIVE', '已有未结束订单'],
    ['strategy.unsupported.type', {}, `UPDATE c_charging_pile SET device_type=999,running_status=0 WHERE pile_id='${pile}'`, '尚未接入充电策略']
  ];
  for (const [name, params, setup, expected] of cases) {
    sql(`UPDATE c_member SET tenant_id=9999 WHERE member_id=${memberId};
      UPDATE c_charging_pile SET deleted=0,device_type=4,running_status=1 WHERE pile_id='${pile}';
      UPDATE c_charging_port SET tenant_id=9999,state='N',can_use=0,gun_status=0 WHERE pile_id='${pile}';
      DELETE FROM c_charging_order WHERE pile_id='${pile}'`);
    if (setup === 'ACTIVE') rawOrder(run + '-active', pile); else if (setup) sql(setup);
    const before = sql(`SELECT COUNT(*) FROM c_charging_order WHERE pile_id='${pile}'`);
    const r = await req(39206, 'charge/startCharge', { ...base, ...params });
    assert.notEqual(r.code, 200, name); assert(String(r.msg).includes(expected), name + ': ' + JSON.stringify(r));
    assert.equal(sql(`SELECT COUNT(*) FROM c_charging_order WHERE pile_id='${pile}'`), before);
    assert.equal(sql(`SELECT COUNT(*) FROM c_order_log l JOIN c_charging_order o ON o.order_number=l.order_number WHERE o.pile_id='${pile}'`), '0');
    assert.equal(sql(`SELECT COUNT(*) FROM c_points_event e JOIN c_charging_order o ON o.order_id=e.order_id WHERE o.pile_id='${pile}'`), '0');
    check(name, { code: r.code, message: r.msg, noOrderLogEventSideEffects: true });
  }
  report.ruleCount = 12; report.strategyRejectionCount = 1;
}
async function start(f) {
  const o = await mp('saveOrder', { portId: f.portId, userId: memberId, amount: 50, hour: 1 });
  assert.equal(String(o.portId), f.portId); assert.equal(o.pileId, f.pile); assert(o.orderNumber && o.orderId);
  online.add(f.pile); return o;
}
const detail = o => mp('orderDetail', { orderNumber: o.orderNumber });
const end = o => mp('endCharge', { pileId: o.pileId, port: o.portId, orderNumber: o.orderNumber });
function verifySettled(o) {
  assert.equal(String(o.orderState), '3'); assert.equal(String(o.chargeStatus), '9003');
  assert(Number(o.consumePower) > 0); assert(Number(o.ordergold) > 0); assert(Number(o.chargeFee) > 0); assert(Number(o.serviceFee) > 0);
  assert(Math.abs(Number(o.ordergold) - Number(o.chargeFee) - Number(o.serviceFee)) < 0.011);
  assert.equal(String(o.hour), '1'); assert(o.realEndTime && o.payTime);
}
function snapshot(o) {
  return { orderId: o.orderId, orderNumber: o.orderNumber, orderState: o.orderState, chargeStatus: o.chargeStatus,
    energy: o.consumePower, amount: o.ordergold, electricFee: o.chargeFee, serviceFee: o.serviceFee, bookedHours: o.hour };
}
async function simulator() {
  const fixtures = seed(workers), first = fixtures[0];
  const started = performance.now();
  let o = await start(first);
  let d = await waitFor('real simulator heartbeat', () => detail(o), x => x.chargeStatus === '9002' && Number(x.consumePower) > 0);
  assert(Number(d.chargingCurrent) > 0 && Number(d.chargingCdgl) > 0); assert.equal(String(d.hour), '1');
  check('S1 authenticated start and nonzero real simulator electrical telemetry', snapshot(d));
  const energy = Number(d.consumePower);
  d = await waitFor('cumulative energy increase', () => detail(o), x => Number(x.consumePower) > energy);
  check('S2 subsequent heartbeat increases energy and preserves booked hour', { before: energy, after: d.consumePower, bookedHours: d.hour });
  await end(o); d = await waitFor('settlement', () => detail(o), x => x.orderState === '3'); verifySettled(d);
  check('S3 database port ID stop retains nonzero energy and fees', snapshot(d));
  const terminal = snapshot(d); await end(o); await pause(6000);
  assert.deepEqual(snapshot(await detail(o)), terminal);
  assert.equal(sql(`SELECT COUNT(*) FROM c_order_log WHERE order_number='${o.orderNumber}' AND brief_info='完成订单'`), '1');
  assert.equal(sql(`SELECT COUNT(*) FROM c_points_event WHERE order_id='${o.orderId}'`), '1');
  check('S4 duplicate stop and delayed observation preserve terminal data', terminal);
  await sim('stop', first.pile); online.delete(first.pile);
  const normalId = run + '-ordinary'; rawOrder(normalId, first.pile);
  const before = sql(`SELECT order_state,charge_status,IFNULL(ordergold,'NULL'),IFNULL(stop_reason,'NULL') FROM c_charging_order WHERE order_id='${normalId}'`);
  const blocked = await req(39208, 'evcs/sim/v1/start', { pileId: first.pile });
  assert.notEqual(blocked.code, 200); assert(String(blocked.msg).includes('普通订单'));
  assert.equal(sql(`SELECT order_state,charge_status,IFNULL(ordergold,'NULL'),IFNULL(stop_reason,'NULL') FROM c_charging_order WHERE order_id='${normalId}'`), before);
  check('S5 simulator startup refuses unfinished ordinary order without mutation', { message: blocked.msg });
  sql(`DELETE FROM c_charging_order WHERE order_id='${normalId}'`);
  const testId = run + '-test'; rawOrder(testId, first.pile, 'TEST-' + run);
  await sim('start', first.pile); online.add(first.pile);
  assert.equal(sql(`SELECT CONCAT(order_state,':',charge_status) FROM c_charging_order WHERE order_id='${testId}'`), '2:9003');
  assert.equal(sql(`SELECT COUNT(*) FROM c_points_event WHERE order_id='${testId}'`), '0');
  check('S6 simulator startup cancels only leftover TEST order without awarding points');
  o = await start(first);
  await waitFor('active order before device shutdown', () => detail(o), x => Number(x.consumePower) > 0);
  await sim('stop', first.pile); online.delete(first.pile);
  d = await waitFor('device shutdown settlement', () => detail(o), x => x.orderState === '3'); verifySettled(d);
  await sim('start', first.pile); online.add(first.pile);
  assert.deepEqual(snapshot(await detail(o)), snapshot(d));
  check('S7 device shutdown settles active order and restart preserves completed data', snapshot(d));
  const batchStart = performance.now(); let completed = 0;
  for (let offset = 0; offset < count; offset += workers) {
    const active = fixtures.slice(0, Math.min(workers, count - offset));
    const created = await Promise.allSettled(active.map(start));
    const errors = created.filter(x => x.status === 'rejected');
    if (errors.length) throw new AggregateError(errors.map(x => x.reason), 'start batch failed');
    const orders = created.map(x => x.value);
    const rows = await Promise.allSettled(orders.map(async order => {
      const live = await waitFor('endurance real heartbeat', () => detail(order), x => Number(x.consumePower) > 0 && x.chargeStatus === '9002');
      assert.equal(String(live.hour), '1');
      await end(order);
      const settled = await waitFor('endurance settlement', () => detail(order), x => x.orderState === '3');
      verifySettled(settled); assert(Number(settled.consumePower) >= Number(live.consumePower));
      return { ...snapshot(settled), observedChargingEnergy: live.consumePower };
    }));
    rows.forEach((x, i) => report.orders.push(x.status === 'fulfilled' ? { ok: true, ...x.value } : { ok: false, orderId: orders[i].orderId, error: String(x.reason.stack || x.reason) }));
    completed += rows.filter(x => x.status === 'fulfilled').length;
    report.progress = { attempted: report.orders.length, completed, elapsedSeconds: (performance.now() - batchStart) / 1000 }; save();
    console.log('PROGRESS ' + JSON.stringify(report.progress));
    const failed = rows.filter(x => x.status === 'rejected');
    if (failed.length) throw new AggregateError(failed.map(x => x.reason), 'charging cycle failed');
  }
  await pause(6000);
  report.reconciliation = JSON.parse(sql(`SELECT JSON_OBJECT(
    'successfulCycles',${completed},
    'settledOrders',SUM(order_state='3' AND charge_status='9003'),
    'positiveSettledOrders',SUM(order_state='3' AND charge_status='9003' AND consume_power>0 AND CAST(ordergold AS DECIMAL(12,2))>0),
    'completionLogs',(SELECT COUNT(*) FROM c_order_log l JOIN c_charging_order x ON x.order_number=l.order_number WHERE x.pile_id LIKE '${run}-%' AND l.brief_info='完成订单'),
    'outboxEvents',(SELECT COUNT(*) FROM c_points_event e JOIN c_charging_order x ON x.order_id=e.order_id WHERE x.pile_id LIKE '${run}-%'))
    FROM c_charging_order WHERE pile_id LIKE '${run}-%'`));
  for (const field of ['settledOrders', 'positiveSettledOrders', 'completionLogs', 'outboxEvents']) assert.equal(report.reconciliation[field], count + 2, field);
  // Check every measured order again after callbacks/next sessions, not just aggregate counts.
  const finalRows = sql(`SELECT order_id,consume_power,ordergold,charge_fee,service_fee,order_state,charge_status FROM c_charging_order WHERE pile_id LIKE '${run}-%'`)
    .split('\n').map(line => line.split('\t'));
  const final = new Map(finalRows.map(r => [r[0], r]));
  for (const expected of report.orders) {
    const actual = final.get(expected.orderId); assert(actual);
    assert.equal(Number(actual[1]), Number(expected.energy)); assert.equal(Number(actual[2]), Number(expected.amount));
    assert.equal(Number(actual[3]), Number(expected.electricFee)); assert.equal(Number(actual[4]), Number(expected.serviceFee));
    assert.equal(actual[5], '3'); assert.equal(actual[6], '9003');
  }
  check('S8 repeated complete real simulated charging cycles with per-order reconciliation', report.reconciliation);
  report.durationSeconds = (performance.now() - started) / 1000;
  report.cycleSeconds = (performance.now() - batchStart) / 1000;
}
async function cleanup() {
  const failures = [];
  for (const pile of online) {
    try { await sim('stop', pile); } catch (error) { failures.push(String(error)); }
  }
  // Threads sleep for 5s/10s; let them see stopped state before deleting fixtures.
  if (online.size) await pause(11000);
  sql(`UPDATE c_points_event e JOIN c_charging_order o ON o.order_id=e.order_id SET e.status='DEAD' WHERE o.pile_id LIKE '${run}-%';`);
  sql(`START TRANSACTION;
    DELETE FROM c_member_points_ledger WHERE member_id=${memberId}; DELETE FROM c_user_credit WHERE member_id=${memberId};
    DELETE e FROM c_points_event e JOIN c_charging_order o ON o.order_id=e.order_id WHERE o.pile_id LIKE '${run}-%';
    DELETE l FROM c_order_log l JOIN c_charging_order o ON o.order_number=l.order_number WHERE o.pile_id LIKE '${run}-%';
    DELETE FROM c_charging_order WHERE pile_id LIKE '${run}-%';
    DELETE FROM c_heartbeat WHERE pile_id LIKE '${run}-%';
    DELETE FROM c_charging_port WHERE pile_id LIKE '${run}-%';
    DELETE FROM c_charging_pile WHERE pile_id LIKE '${run}-%' AND remark='${run}';
    DELETE FROM c_member WHERE member_id=${memberId} AND user_name='${run}'; COMMIT;`);
  redis('DEL', 'member:token:' + token);
  const residual = sql(`SELECT (SELECT COUNT(*) FROM c_charging_order WHERE pile_id LIKE '${run}-%')+
    (SELECT COUNT(*) FROM c_charging_pile WHERE pile_id LIKE '${run}-%')+
    (SELECT COUNT(*) FROM c_charging_port WHERE pile_id LIKE '${run}-%')+
    (SELECT COUNT(*) FROM c_member WHERE member_id=${memberId})+
    (SELECT COUNT(*) FROM c_member_points_ledger WHERE member_id=${memberId})+
    (SELECT COUNT(*) FROM c_user_credit WHERE member_id=${memberId})`);
  assert.equal(residual, '0', 'fixture cleanup');
  if (failures.length) throw new Error('simulator stop failed: ' + failures.join('; '));
  report.cleanup = 'completed; fixture residual count=0';
}
(async () => {
  save(); console.log('REPORT ' + reportFile);
  try {
    report.images = execFileSync('docker', ['inspect', 'hcp-operator', 'hcp-mp', 'hcp-simulator', '--format', '{{.Name}} {{.Image}} {{.State.StartedAt}}'], { encoding: 'utf8' }).trim();
    await ({ validation, simulator }[mode])(); report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.error = String(error.stack || error); process.exitCode = 1; console.error(error); }
  finally {
    try { await cleanup(); } catch (error) { report.cleanup = 'FAILED: ' + String(error.stack || error); process.exitCode = 1; console.error(error); }
    report.finishedAt = new Date().toISOString(); save(); console.log('RESULT ' + JSON.stringify({ status: report.status, cleanup: report.cleanup, reportFile }));
  }
})();
