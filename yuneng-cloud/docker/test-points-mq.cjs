const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const prefix = 'TEST-MQ-' + Date.now();
const member = 800000000 + Math.floor(Math.random() * 100000000);
function docker(...args) { return execFileSync('docker', args, {encoding:'utf8',stdio:['pipe','pipe','pipe']}); }
function sql(query) {
  return execFileSync('docker',['exec','-i','-e','MYSQL_PWD=password','hcp-mysql','mysql','-uroot','--batch','--skip-column-names','vctgo_platform'],{input:query,encoding:'utf8'}).trim();
}
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,timeout=90000) {
  const start=Date.now();
  while(Date.now()-start<timeout) { if(check()) return; await sleep(1000); }
  throw new Error('Timeout: '+label);
}
function create(suffix) {
  const id=prefix+'-'+suffix;
  sql(`INSERT INTO c_charging_order(order_id,order_number,user_id,pile_id,port_id,tenant_id,order_state,charge_status,start_time,create_time)
    VALUES('${id}','${id}',${member},'202312121',1,9999,'1','9002','2026-10-12 10:00:00',NOW());`);
  return id;
}
async function settle(id,amount='8.20') {
  const p={orderId:id,totalPower:'4.8',totalAmount:amount,electricFee:amount,serviceFee:'0',
    startTime:'2026-10-12 10:00:00',endTime:'2026-10-12 10:30:00',stopReason:'MQ integration fixture'};
  const result=await (await fetch('http://127.0.0.1:39206/charge/orderInfo?'+new URLSearchParams(p))).json();
  assert.equal(result.code,200,JSON.stringify(result));
}
function status(id) { return sql(`select status from c_points_event where order_id='${id}'`); }
function count(id) { return Number(sql(`select count(*) from c_member_points_ledger where member_id=${member} and business_key='ORDER:${id}'`)); }
async function receipt(id) { await until(()=>status(id)==='CONSUMED','receipt '+id); assert.equal(count(id),1); }
async function main() {
  sql(`insert into c_member(member_id,user_name,tenant_id) values(${member},'${prefix}',9999);`);
  try {
    const normal=create('normal');
    await Promise.all(Array.from({length:8},()=>settle(normal)));
    await receipt(normal);
    assert.equal(sql(`select publish_attempts from c_points_event where order_id='${normal}'`),'1');
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'8');
    console.log('PASS concurrent settlement produces one event; real MQ awards once');

    // Redeliver same durable event through real producer, even with existing reward ledger.
    sql(`update c_points_event set status='PENDING',next_retry_at=now() where order_id='${normal}';`);
    await receipt(normal);
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'8');
    console.log('PASS duplicate delivery leaves balance and ledger unchanged');

    const zero=create('zero'); await settle(zero,'0.50'); await receipt(zero);
    assert.equal(sql(`select points from c_member_points_ledger where member_id=${member} and business_key='ORDER:${zero}'`),'0');
    console.log('PASS sub-yuan reward is processed without infinite retry');

    // Stop broker; order must still commit, attempts must fail, and scheduled scan must recover.
    docker('stop','hcp-mq-broker');
    const outage=create('outage'); await settle(outage);
    await until(()=>status(outage)==='RETRY','durable publish failure');
    assert.equal(count(outage),0);
    docker('start','hcp-mq-broker'); await receipt(outage);
    assert.ok(Number(sql(`select publish_attempts from c_points_event where order_id='${outage}'`))>=2);
    console.log('PASS broker outage preserves settlement; timed publisher retries after recovery');

    // A consumer-down window shows broker ACK is distinct from points receipt.
    docker('stop','hcp-mp');
    const delayed=create('delayed'); await settle(delayed);
    await until(()=>status(delayed)==='SENT','broker ACK while consumer offline');
    assert.equal(count(delayed),0);
    // Accelerate just this fixture's receipt timeout; let scheduled scan claim it normally.
    sql(`update c_points_event set next_retry_at=now() where order_id='${delayed}';`);
    await until(()=>Number(sql(`select publish_attempts from c_points_event where order_id='${delayed}'`))>=2,'missing receipt compensation');
    docker('start','hcp-mp'); await receipt(delayed);
    console.log('PASS missing receipt scheduled compensation and consumer restart');

    // Invalid DB value forces award transaction rollback, followed by real broker retry.
    docker('stop','hcp-mp');
    const failure=create('failure'); await settle(failure);
    await until(()=>status(failure)==='SENT','failure event sent');
    sql(`update c_charging_order set ordergold='bad-value' where order_id='${failure}';`);
    docker('start','hcp-mp');
    await until(()=>Number(sql(`select consume_failures from c_points_event where order_id='${failure}'`))>=1,'consumer failure recorded',120000);
    assert.equal(count(failure),0);
    sql(`update c_charging_order set ordergold='8.20' where order_id='${failure}';`);
    await receipt(failure);
    console.log('PASS award failure rolls back; broker retry awards after repair');

    // Expired publisher lease is recovered by timer, not a direct invocation.
    docker('stop','hcp-mp');
    const lease=create('lease'); await settle(lease);
    await until(()=>status(lease)==='SENT','lease fixture sent');
    sql(`update c_points_event set status='PUBLISHING',lease_token='crashed-worker',next_retry_at=now() where order_id='${lease}';`);
    await until(()=>status(lease)==='SENT','expired publisher lease recovery');
    docker('start','hcp-mp'); await receipt(lease);
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'40');
    console.log('PASS expired worker lease recovery; all rewards total exactly 40');
  } finally {
    docker('start','hcp-mq-broker','hcp-mp');
    // Stop delivering fixture events before deleting their member/account.
    sql(`update c_points_event set status='DEAD' where order_id like '${prefix}%';`);
    sql(`delete from c_member_points_ledger where member_id=${member}; delete from c_user_credit where member_id=${member};
      delete from c_points_event where order_id like '${prefix}%'; delete from c_order_log where order_number like '${prefix}%';
      delete from c_charging_order where order_id like '${prefix}%'; delete from c_member where member_id=${member};`);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
