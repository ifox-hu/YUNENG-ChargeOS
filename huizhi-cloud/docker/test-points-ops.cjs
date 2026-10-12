const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:8001/prod-api/';
const prefix='TEST-MQ-OPS-'+Date.now(),member=800000000+Math.floor(Math.random()*100000000),session=crypto.randomUUID();
let token,browser;
function docker(...args){return execFileSync('docker',args,{encoding:'utf8'}).trim()}
function sql(q){return execFileSync('docker',['exec','-i','-e','MYSQL_PWD=password','hcp-mysql','mysql','-uroot','--batch','--skip-column-names','vctgo_platform'],{input:q,encoding:'utf8'}).trim()}
function redis(...args){return docker('exec','hcp-redis','redis-cli','-n','5',...args)}
async function req(url,method='GET',headers={},data){return (await fetch(url,{method,headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined})).json()}
async function until(check,label){for(let i=0;i<120;i++){if(await check())return;await new Promise(r=>setTimeout(r,1000))}throw new Error('Timeout: '+label)}
function create(suffix){const id=prefix+'-'+suffix;sql(`insert into c_charging_order(order_id,order_number,user_id,pile_id,port_id,tenant_id,order_state,charge_status,start_time,create_time) values('${id}','${id}',${member},'202312121',1,9999,'1','9002','2026-10-12 10:00:00',now());`);return id}
async function settle(id){const p={orderId:id,totalPower:'1',totalAmount:'8.20',electricFee:'8.20',serviceFee:'0',startTime:'2026-10-12 10:00:00',endTime:'2026-10-12 10:30:00',stopReason:'MQ ops fixture'};assert.equal((await req('http://127.0.0.1:39206/charge/orderInfo?'+new URLSearchParams(p))).code,200)}
function status(id){return sql(`select status from c_points_event where order_id='${id}'`)}
async function main(){
  sql(`insert into c_member(member_id,user_name,tenant_id) values(${member},'${prefix}',9999)`);
  redis('SET','member:token:'+session,String(member),'EX','600');
  try {
    const captcha=await req(base+'code');let code=redis('GET','captcha_codes:'+captcha.uuid);try{code=JSON.parse(code)}catch{}
    const login=await req(base+'auth/login','POST',{}, {username:'admin',password:'admin123',uuid:captcha.uuid,code});assert.equal(login.code,200);token=login.data.access_token;
    const headers={Authorization:'Bearer '+token};
    assert.notEqual((await req(base+'operator/points/events')).code,200);
    const normal=create('manual');await settle(normal);
    const claims=await Promise.all(Array.from({length:12},()=>req('http://127.0.0.1:39207/points/orders/'+normal+'/claim','POST',{token:'Bearer '+session})));
    claims.forEach(r=>assert.equal(r.code,200,JSON.stringify(r)));
    await until(()=>status(normal)==='CONSUMED','manual/auto receipt');
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'8');
    assert.equal(sql(`select count(*) from c_member_points_ledger where member_id=${member}`),'1');
    console.log('PASS concurrent manual claim and auto MQ award credit only once; anonymous monitoring denied');

    docker('stop','hcp-mp');
    const ceiling=create('ceiling');await settle(ceiling);
    await until(()=>status(ceiling)==='SENT','ceiling event sent');
    sql(`update c_points_event set publish_attempts=12,next_retry_at=now() where order_id='${ceiling}'`);
    await until(()=>status(ceiling)==='DEAD','publish/receipt retry ceiling');
    console.log('PASS scheduled compensation stops at publish/receipt retry limit');
    const failed=create('dead');await settle(failed);
    sql(`update c_charging_order set ordergold='bad-value' where order_id='${failed}'; update c_points_event set consume_failures=11 where order_id='${failed}'`);
    docker('start','hcp-mp');
    await until(()=>status(failed)==='DEAD','consume retry ceiling');
    const event=sql(`select event_id from c_points_event where order_id='${failed}'`);
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'8','failed award changed balance');
    assert.equal(Number(sql(`select consume_failures from c_points_event where order_id='${failed}'`)),12);
    const list=await req(base+'operator/points/events?status=DEAD','GET',headers);
    assert.equal(list.code,200);assert.ok(list.data.some(row=>row.event_id===event));
    console.log('PASS bounded consume failure becomes DEAD with no partial award');
    sql(`update c_charging_order set ordergold='8.20' where order_id='${failed}'`);

    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1500,height:1000}});
    await context.addCookies([{name:'Admin-Token',value:token,url:'http://127.0.0.1:8001'},{name:'Admin-Tenant',value:'9999',url:'http://127.0.0.1:8001'}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8001/operate/order');
    try { await page.locator('.points-events > button').click(); }
    catch(error) { console.error('Browser URL:',page.url(),'Body:',(await page.locator('body').innerText()).slice(0,1400),'Errors:',errors); throw error; }
    const dialog=page.locator('.el-dialog:visible');
    const row=dialog.locator('tr').filter({hasText:failed});
    await row.getByRole('button',{name:'重新投递',exact:true}).click();
    await page.locator('.el-message-box').getByRole('button',{name:'确定',exact:true}).click();
    await until(()=>status(failed)==='CONSUMED','admin UI requeue receipt');
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'16');
    const ceilingEvent=sql(`select event_id from c_points_event where order_id='${ceiling}'`);
    assert.equal((await req(base+'operator/points/events/'+ceilingEvent+'/retry','POST',headers)).code,200);
    await until(()=>status(ceiling)==='CONSUMED','publish-ceiling manual recovery');
    assert.equal(sql(`select credit from c_user_credit where member_id=${member}`),'24');
    assert.notEqual((await req(base+'operator/points/events/'+event+'/retry','POST',headers)).code,200,'consumed event must not requeue');
    assert.equal(errors.length,0,errors.join(';'));
    console.log('PASS real admin dialog shows failure; button requeues repaired event; consumed retry rejected; no browser errors');
  }finally{
    if(browser)await browser.close();docker('start','hcp-mp');redis('DEL','member:token:'+session);
    sql(`update c_points_event set status='DEAD' where order_id like '${prefix}%'; delete from c_member_points_ledger where member_id=${member}; delete from c_user_credit where member_id=${member}; delete from c_points_event where order_id like '${prefix}%'; delete from c_order_log where order_number like '${prefix}%'; delete from c_charging_order where order_id like '${prefix}%'; delete from c_member where member_id=${member};`);
    if(token)await req(base+'auth/logout','DELETE',{Authorization:'Bearer '+token});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
