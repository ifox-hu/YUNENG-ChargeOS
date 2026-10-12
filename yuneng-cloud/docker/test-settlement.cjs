const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const id = 'TEST-SETTLEMENT-' + Date.now();
const member = 800000000 + Math.floor(Math.random()*100000000);
const trigger = 'test_outbox_' + Date.now();
function sql(query) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=password', 'hcp-mysql',
    'mysql', '-uroot', '--batch', '--skip-column-names', 'vctgo_platform'],
  { input: query, encoding: 'utf8' }).trim();
}
async function call(route, params) {
  const response = await fetch('http://127.0.0.1:39206/charge/' + route + '?' + new URLSearchParams(params));
  return response.json();
}
async function main() {
  // Only disposable TEST orders are inserted; existing orders and balances are untouched.
  sql(`INSERT INTO c_member(member_id,user_name,tenant_id) VALUES(${member},'${id}',9999);
    INSERT INTO c_charging_order(order_id,order_number,user_id,pile_id,port_id,tenant_id,
    order_state,charge_status,start_time,create_time)
    VALUES('${id}','${id}',${member},'202312121',1,9999,'1','9002','2026-10-12 10:00:00',NOW());`);
  try {
    const params = { orderId: id, totalPower: '4.8', totalAmount: '8.20000030100345620',
      electricFee: '7.20000030100345620', serviceFee: '1', startTime: '2026-10-12 10:00:00',
      endTime: '2026-10-12 10:30:00', stopReason: 'settlement regression test' };
    const invalid = await call('orderInfo', { ...params, totalAmount: '99' });
    assert.notEqual(invalid.code, 200);
    assert.equal(sql(`SELECT order_state FROM c_charging_order WHERE order_id='${id}'`), '1');
    assert.equal(sql(`SELECT COUNT(*) FROM c_points_event WHERE order_id='${id}'`), '0');
    // Force failure at the LAST write: order and completion log must also roll back.
    sql(`DELIMITER //
      CREATE TRIGGER ${trigger} BEFORE INSERT ON c_points_event FOR EACH ROW
      BEGIN IF NEW.order_id='${id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated outbox rollback fixture'; END IF; END//
      DELIMITER ;`);
    assert.notEqual((await call('orderInfo', params)).code,200);
    assert.equal(sql(`SELECT order_state FROM c_charging_order WHERE order_id='${id}'`), '1');
    assert.equal(sql(`SELECT COUNT(*) FROM c_order_log WHERE order_number='${id}'`),'0');
    sql(`DROP TRIGGER ${trigger};`);
    const results = await Promise.all(Array.from({ length: 8 }, () => call('orderInfo', params)));
    results.forEach(r => assert.equal(r.code, 200, JSON.stringify(r)));
    const snapshot = () => sql(`SELECT CONCAT_WS('|',order_state,charge_status,ordergold,end_time,
      real_hour,charge_fee,service_fee,consume_power) FROM c_charging_order WHERE order_id='${id}'`);
    const settled = snapshot();
    assert.ok(settled.startsWith('3|9003|8.20|2026-10-12 10:30:00|0.5000|'), settled);
    assert.equal(sql(`SELECT COUNT(*) FROM c_order_log WHERE order_number='${id}'`), '1');
    assert.equal(sql(`SELECT COUNT(*) FROM c_points_event WHERE order_id='${id}'`), '1');
    await call('orderInfo', { ...params, totalAmount: '99' });
    await call('startResult', { orderId: id, pileId: '202312121', port: '1', startResult: '0', failReason: '' });
    await call('chargingHeartBeat', { orderId: id, pileId: '202312121', port: '1', status: '1',
      voltage: '220', electric: '32', soc: '50', chargePower: '9', chargeFee: '99',
      serviceFee: '1', chargePrice: '100' });
    assert.equal(snapshot(), settled, 'late callbacks changed a settled order');
    console.log('PASS invalid amounts and outbox failure roll back order/log; concurrent settlement creates one event/log; money/time accurate; late callbacks ignored');
  } finally {
    sql(`DROP TRIGGER IF EXISTS ${trigger};`);
    sql(`START TRANSACTION; DELETE FROM c_points_event WHERE order_id='${id}';
      DELETE FROM c_member_points_ledger WHERE member_id=${member}; DELETE FROM c_user_credit WHERE member_id=${member};
      DELETE FROM c_order_log WHERE order_number='${id}'; DELETE FROM c_charging_order WHERE order_id='${id}';
      DELETE FROM c_member WHERE member_id=${member}; COMMIT;`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
