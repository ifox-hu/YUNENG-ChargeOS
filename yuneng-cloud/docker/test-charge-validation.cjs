const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const pile = 'TEST-VALIDATE-' + Date.now();
let portId;
function sql(query) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=password', 'hcp-mysql',
    'mysql', '-uroot', '--batch', '--skip-column-names', 'vctgo_platform'], { input: query, encoding: 'utf8' }).trim();
}
async function start(extra = {}) {
  return (await fetch('http://127.0.0.1:39206/charge/startCharge?' + new URLSearchParams({
    pileId: pile, port: '1', userId: '1008', amount: '50', hour: '1', ...extra
  }))).json();
}
async function main() {
  // Isolated fixture devices keep the user's station data untouched.
  sql(`INSERT INTO c_charging_pile(pile_id,device_type,pile_type,tenant_id,running_status,deleted)
    VALUES('${pile}',4,1,9999,0,0);
    INSERT INTO c_charging_port(pile_id,device_id,tenant_id,state,can_use,gun_status)
    VALUES('${pile}','1',9999,'N',0,0);`);
  portId = sql(`SELECT port_id FROM c_charging_port WHERE pile_id='${pile}'`);
  try {
    for (const params of [{ hour: '0' }, { amount: '-1' }, { userId: '99999999' }]) {
      assert.notEqual((await start(params)).code, 200);
    }
    sql(`UPDATE c_charging_port SET tenant_id=8888 WHERE port_id=${portId}`);
    assert.notEqual((await start()).code, 200);
    sql(`UPDATE c_charging_port SET tenant_id=9999,state='F' WHERE port_id=${portId}`);
    assert.notEqual((await start()).code, 200);
    sql(`UPDATE c_charging_port SET state='N',can_use=1 WHERE port_id=${portId}`);
    assert.notEqual((await start()).code, 200);
    sql(`UPDATE c_charging_port SET can_use=0 WHERE port_id=${portId};
      INSERT INTO c_charging_order(order_id,order_number,pile_id,port_id,user_id,tenant_id,order_state,charge_status)
      VALUES('${pile}','${pile}','${pile}',${portId},1008,9999,'1','9001');`);
    assert.notEqual((await start()).code, 200);
    sql(`DELETE FROM c_charging_order WHERE order_id='${pile}';
      UPDATE c_charging_pile SET device_type=999 WHERE pile_id='${pile}';`);
    assert.notEqual((await start()).code, 200);
    assert.equal(sql(`SELECT COUNT(*) FROM c_charging_order WHERE pile_id='${pile}'`), '0');
    sql(`UPDATE c_charging_pile p JOIN c_charging_pile template ON template.pile_id='202312121'
      SET p.device_type=4,p.station_id=template.station_id,p.user_id=template.user_id,
      p.electricity=template.electricity,p.voltage=template.voltage,p.max_power=template.max_power,
      p.wx_rule_id=template.wx_rule_id,p.cp_fee_type=template.cp_fee_type WHERE p.pile_id='${pile}';`);
    const result = await start();
    assert.equal(result.code, 200, JSON.stringify(result));
    assert.ok(result.data?.orderNumber);
    assert.notEqual((await start()).code, 200, 'duplicate start was accepted');
    assert.equal(sql(`SELECT COUNT(*) FROM c_charging_order WHERE pile_id='${pile}'`), '1');
    // Wait for the simulator's asynchronous start callback before stopping this isolated order.
    for (let i = 0; i < 30; i++) {
      if (sql(`SELECT charge_status FROM c_charging_order WHERE pile_id='${pile}'`) === '9002') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const stop = await (await fetch('http://127.0.0.1:39206/charge/stopCharge?' +
      new URLSearchParams({ pileId: pile, port: '1' }))).json();
    assert.equal(stop.code, 200, JSON.stringify(stop));
    console.log('PASS simulator strategy starts and stops isolated device; duplicate start creates no additional order');
    console.log('PASS invalid parameters, missing member, tenant mismatch, fault, disabled port, active order, unsupported strategy; no order side effects');
  } finally {
    // Stop only this disposable simulator before removing its database fixtures.
    await fetch('http://127.0.0.1:39208/evcs/sim/v1/stop?' + new URLSearchParams({ pileId: pile })).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 1500));
    sql(`DELETE l FROM c_order_log l JOIN c_charging_order o ON l.order_number=o.order_number WHERE o.pile_id='${pile}';`);
    sql(`DELETE FROM c_charging_order WHERE pile_id='${pile}';
      DELETE FROM c_charging_port WHERE pile_id='${pile}'; DELETE FROM c_charging_pile WHERE pile_id='${pile}';`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
