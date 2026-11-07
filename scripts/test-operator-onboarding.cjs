// Real gateway/API/database proof. Dedicated tenants only; no credentials in output.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {sql,literal:q,login,until}=require('./lib/device-alarm-testkit.cjs');
const run='QA_ONBOARD_'+Date.now();
const tenantBase=760000000+crypto.randomInt(1000000), pack=tenantBase+10;
const tenants=[tenantBase,tenantBase+1,tenantBase+2,tenantBase+3];
const password=crypto.randomBytes(6).toString('hex')+'Aa1!';
const report={run,scope:'Local single instance; two real operator identities; simulated devices; not real hardware or production capacity',checks:[],onboardingMs:[],startedAt:new Date().toISOString()};
const out=path.join(__dirname,'../docs/test-results/operator-onboarding-2026-11-07.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function pass(name,data={}) {report.checks.push({name,...data});console.log('PASS '+name);}
async function req(route,token,method='GET',body,headers={}) {
 const r=await fetch('http://127.0.0.1:38080/'+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000)});
 const raw=await r.text();try{return {...JSON.parse(raw),http:r.status}}catch{throw new Error('Non-JSON HTTP '+r.status+' on '+route)}
}
async function ok(...args) {const r=await req(...args);assert.equal(r.code,200,JSON.stringify({route:args[0],code:r.code,msg:r.msg}));return r.data;}
async function deny(...args) {const r=await req(...args);assert.notEqual(r.code,200,'Unexpected authorization on '+args[0]);return r;}
async function form(route,params) {
 const r=await fetch('http://127.0.0.1:38080/hcp-mp/v1/auth/account/'+route,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(30000)});
 return r.json();
}
const accountName=i=>'qaon_'+String(tenantBase+i);
const tenant=i=>({id:tenants[i],tenantName:'验证运营商'+i,userName:accountName(i),userPhone:'13800000000',userEmail:'local-test@example.invalid',tenantPackage:pack,tenantTime:'2027-12-31',status:0});
async function onboard(root,i,overrides={}) {
 const t=performance.now();const r=await req('system/tenant/onboard',root,'POST',{tenant:{...tenant(i),...overrides},initialPassword:password});
 if(r.code===200)report.onboardingMs.push(Number((performance.now()-t).toFixed(3)));return r;
}
async function member(i) {
 const username='qam_'+tenants[i], mobile='139'+String(tenants[i]).slice(-8);
 const code=await form('code',{mobile});assert.equal(code.code,200);
 const reg=await form('register',{username,password,mobile,code:code.data.testCode,tenantCode:tenants[i]});assert.equal(reg.code,200,JSON.stringify(reg));
 const result=await form('login',{username,password});assert.equal(result.code,200);
 assert.equal(result.data.member.tenantId,tenants[i]);
 return {token:result.data.token,id:result.data.member.memberId,username};
}
const mp=(route,m,params={})=>ok('hcp-mp/order/'+route+'?'+new URLSearchParams(params),null,'GET',undefined,{token:'Bearer '+m.token});
function snapshot(tenantId) {return sql(`SELECT (SELECT COUNT(*) FROM c_charging_order WHERE tenant_id=${tenantId}),(SELECT COUNT(*) FROM c_order_log WHERE tenant_id=${tenantId}),(SELECT COUNT(*) FROM c_points_event WHERE tenant_id=${tenantId})`);}
function cleanup() {
 const ids=tenants.join(',');
 for(let i=0;i<2;i++) {
  try{execFileSync('docker',['exec','hcp-simulator','true'],{stdio:'ignore'})}catch{}
 }
 // IDs are random dedicated tenant codes, confirmed to be absent before setup.
 sql(`START TRANSACTION;
 DELETE FROM c_device_alarm_event_audit WHERE event_pk IN(SELECT id FROM c_device_alarm_event WHERE tenant_id IN(${ids}));
 DELETE FROM c_device_alarm_event WHERE tenant_id IN(${ids});
 DELETE FROM c_fault_ticket_log WHERE ticket_id IN(SELECT id FROM c_fault_ticket WHERE tenant_id IN(${ids}));
 DELETE FROM c_fault_report WHERE ticket_id IN(SELECT id FROM c_fault_ticket WHERE tenant_id IN(${ids}));
 DELETE FROM c_device_alarm WHERE ticket_id IN(SELECT id FROM c_fault_ticket WHERE tenant_id IN(${ids}));
 DELETE FROM c_fault_ticket WHERE tenant_id IN(${ids});
 DELETE FROM c_member_points_ledger WHERE member_id IN(SELECT member_id FROM c_member WHERE tenant_id IN(${ids}));
 DELETE FROM c_user_credit WHERE member_id IN(SELECT member_id FROM c_member WHERE tenant_id IN(${ids}));
 DELETE FROM c_points_event WHERE tenant_id IN(${ids});
 DELETE FROM c_order_log WHERE tenant_id IN(${ids}); DELETE FROM c_charging_order WHERE tenant_id IN(${ids});
 DELETE FROM c_heartbeat WHERE pile_id IN(SELECT pile_id FROM c_charging_pile WHERE tenant_id IN(${ids}));
 DELETE FROM c_charging_port WHERE tenant_id IN(${ids}); DELETE FROM c_charging_pile WHERE tenant_id IN(${ids}); DELETE FROM c_charging_station WHERE tenant_id IN(${ids});
 DELETE FROM c_app_account WHERE member_id IN(SELECT member_id FROM c_member WHERE tenant_id IN(${ids}));
 DELETE FROM c_menber_balance WHERE tenant_id IN(${ids}); DELETE FROM c_member WHERE tenant_id IN(${ids});
 DELETE FROM c_operator_charge_whitelist WHERE tenant_id IN(${ids}); DELETE FROM c_operator_charge_rule WHERE tenant_id IN(${ids});
 DELETE FROM sys_user_role WHERE user_id IN(SELECT user_id FROM sys_user WHERE tenant_id IN(${ids}));
 DELETE FROM sys_user_post WHERE user_id IN(SELECT user_id FROM sys_user WHERE tenant_id IN(${ids}));
 DELETE FROM sys_role_menu WHERE role_id IN(SELECT role_id FROM sys_role WHERE tenant_id IN(${ids}));
 DELETE FROM sys_role_dept WHERE role_id IN(SELECT role_id FROM sys_role WHERE tenant_id IN(${ids}));
 DELETE FROM sys_user WHERE tenant_id IN(${ids}); DELETE FROM sys_role WHERE tenant_id IN(${ids}); DELETE FROM sys_post WHERE tenant_id IN(${ids}); DELETE FROM sys_dept WHERE tenant_id IN(${ids});
 DELETE FROM sys_tenant WHERE id IN(${ids}); DELETE FROM sys_tenant_package WHERE id=${pack}; COMMIT;`);
}
async function main() {
 assert.equal(sql(`SELECT COUNT(*) FROM sys_tenant WHERE id IN(${tenants.join(',')})`),'0');
 const menus=sql("SELECT GROUP_CONCAT(menu_id ORDER BY menu_id) FROM sys_menu WHERE parent_id=2066 OR perms LIKE 'operator:%' OR menu_id=2066");
 sql(`INSERT INTO sys_tenant_package(id,name,menu_ids,status,del_flag) VALUES(${pack},${q(run)},${q(menus)},0,'0')`);
 let setup=true, root;
 const online=[]; const memberTokens=[]; const adminTokens=[];
 try {
  root=await login();
  adminTokens.push(root);
  for(let i=0;i<2;i++){const result=await onboard(root,i);assert.equal(result.code,200,result.msg);}
  pass('two root onboardings', {operators:2});
  for(let i=0;i<2;i++) {
   const t=tenants[i];
   assert.equal(sql(`SELECT COUNT(*) FROM sys_user WHERE tenant_id=${t}`),'1');
   for(const table of ['sys_dept','sys_post','sys_role','c_operator_charge_rule'])assert.equal(sql(`SELECT COUNT(*) FROM ${table} WHERE tenant_id=${t}`),'1');
   assert.equal(sql(`SELECT COUNT(*) FROM sys_user_role r JOIN sys_user u ON u.user_id=r.user_id WHERE u.tenant_id=${t}`),'1');
   assert.equal(sql(`SELECT COUNT(*) FROM sys_user_post r JOIN sys_user u ON u.user_id=r.user_id WHERE u.tenant_id=${t}`),'1');
   assert.equal(sql(`SELECT GROUP_CONCAT(rm.menu_id ORDER BY rm.menu_id) FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id WHERE r.tenant_id=${t}`),menus);
  }
  pass('initialization relationships reconciled');
  const admins=[];
  for(let i=0;i<2;i++) {
   try {admins.push(await login(accountName(i),password));}
   catch(err) {
    const diagnostic=await fetch('http://127.0.0.1:39201/user/info/'+accountName(i),{headers:{'from-source':'inner'}}).then(r=>r.json());
    throw new Error('Operator login failed: '+JSON.stringify({code:diagnostic.code,msg:diagnostic.msg}));
   }
  }
  adminTokens.push(...admins);
  pass('two real operator logins');
  await deny('system/tenant/onboard',admins[0],'POST',{tenant:tenant(2),initialPassword:password});
  await deny('system/tenant',admins[0],'POST',tenant(2));
  assert.notEqual((await onboard(root,2,{tenantPackage:-1})).code,200);
  assert.notEqual((await onboard(root,2,{id:9999})).code,200);
  assert.notEqual((await onboard(root,2,{userName:accountName(0)})).code,200);
  sql(`UPDATE sys_tenant_package SET status=1 WHERE id=${pack}`);
  assert.notEqual((await onboard(root,2)).code,200);
  sql(`UPDATE sys_tenant_package SET status=0,menu_ids=CONCAT(menu_ids,',2013') WHERE id=${pack}`);
  assert.notEqual((await onboard(root,2)).code,200);
  sql(`UPDATE sys_tenant_package SET menu_ids=${q(menus)} WHERE id=${pack}`);
  pass('root and input guards');
  // Force failure at the final default-rule write; every initialized business relation must roll back.
  sql(`INSERT INTO c_operator_charge_rule(tenant_id) VALUES(${tenants[2]})`);
  assert.notEqual((await onboard(root,2)).code,200);
  for(const table of ['sys_tenant','sys_user','sys_dept','sys_post','sys_role'])assert.equal(sql(`SELECT COUNT(*) FROM ${table} WHERE ${table==='sys_tenant'?'id':'tenant_id'}=${tenants[2]}`),'0');
  sql(`DELETE FROM c_operator_charge_rule WHERE tenant_id=${tenants[2]}`);
  pass('late initialization rollback');
  const duplicate=await Promise.all([onboard(root,3),onboard(root,3)]);
  assert.equal(duplicate.filter(x=>x.code===200).length,1);
  assert.equal(sql(`SELECT COUNT(*) FROM sys_user WHERE tenant_id=${tenants[3]}`),'1');
  pass('concurrent duplicate onboarding creates one account');
  const members=await Promise.all([member(0),member(1)]);memberTokens.push(...members.map(x=>x.token));
  pass('registered member and wallet tenant ownership');
  for(let i=0;i<2;i++) {
   await deny('operator/member',admins[i],'PUT',{memberId:members[i].id,tenantId:tenants[1-i]});
   await deny('operator/member/info/'+members[1-i].id,admins[i]);
   assert.equal(sql(`SELECT tenant_id FROM c_member WHERE member_id=${members[i].id}`),String(tenants[i]));
  }
  pass('member tenant transfer and internal lookup rejected');
  for(let i=0;i<2;i++) {
   const ownOpenId=sql(`SELECT weixin_openid FROM c_member WHERE member_id=${members[i].id}`);
   const route='hcp-mp/me/getMemberInfoByOpenId?openId='+encodeURIComponent(ownOpenId);
   await deny(route,null);
   await deny(route,null,'GET',undefined,{token:'Bearer '+members[1-i].token});
   const own=await ok(route,null,'GET',undefined,{token:'Bearer '+members[i].token});
   assert.equal(Number(own.memberId),members[i].id);
   await deny('hcp-mp/me/getMemberBalanceByUserId?userId='+members[i].id,null,'GET',undefined,{token:'Bearer '+members[1-i].token});
  }
  pass('member self-service identity boundary');
  const fixtures=[];
  for(let i=0;i<2;i++) {
   const t=tenants[i],a=admins[i],pile=run+'_'+i;
   await ok('operator/station',a,'POST',{stationCode:String(t),stationName:pile,address:'local validation',regionCode:'330100',lat:'30',lng:'120',deviceType:4,delFlag:0});
   const station=Number(sql(`SELECT station_id FROM c_charging_station WHERE tenant_id=${t} AND station_code=${q(t)}`));
   const template=JSON.parse(sql("SELECT JSON_OBJECT('electricity',electricity,'voltage',voltage,'maxPower',max_power,'wxRuleId',wx_rule_id,'cpFeeType',cp_fee_type) FROM c_charging_pile WHERE pile_id='202312121'"));
   await ok('operator/pile',a,'POST',{...template,pileId:pile,name:pile,stationId:station,deviceType:4,pileType:1,runningStatus:1,deleted:0});
   await ok('operator/port',a,'POST',{pileId:pile,deviceId:'1',name:pile,state:'N',canUse:0,gunStatus:0});
   const port=Number(sql(`SELECT port_id FROM c_charging_port WHERE pile_id=${q(pile)}`));
   fixtures.push({pile,port,station});
  }
  pass('stations piles ports created through operator APIs');
  for(let i=0;i<2;i++) {
   const foreign=1-i, a=admins[i];
   await deny('operator/pile',a,'POST',{pileId:run+'_foreign_'+i,stationId:fixtures[foreign].station});
   await deny('operator/chargeRule?targetTenantId='+tenants[foreign],a);
   await deny('operator/chargeRule',a,'PUT',{targetTenantId:tenants[foreign],maxChargingHours:1,whitelistEnabled:false,version:0});
   await deny('operator/chargeRule/member',a,'POST',{targetTenantId:tenants[foreign],memberId:members[foreign].id,version:0});
   const hiddenPile=await req('operator/pile/'+fixtures[foreign].pile,a);
   assert(hiddenPile.code!==200 || hiddenPile.data==null,'Foreign pile detail leaked');
   const hiddenPort=await req('operator/port/'+fixtures[foreign].port,a);
   assert(hiddenPort.code!==200 || hiddenPort.data==null,'Foreign port detail leaked');
   for(const [kind,filter] of [['pile','pileId='+fixtures[foreign].pile],['port','pileId='+fixtures[foreign].pile],['station','stationName='+fixtures[foreign].pile]]) {
    const list=await ok('operator/'+kind+'/list?'+filter,a);
    assert(Array.isArray(list),'Expected '+kind+' list data');assert.equal(list.length,0,'Foreign '+kind+' list leaked');
   }
   await deny('hcp-mp/fault/report',null,'POST',{pileId:fixtures[foreign].pile,faultType:'POWER',description:'foreign tenant denial'},{token:'Bearer '+members[i].token});
   await ok('system/user/getInfo',a,'GET',undefined,{'tenant-id':String(tenants[foreign]),user_id:'1'});
   // getInfo contains the stored account identity; header manipulation cannot change it.
   const rule=await ok('operator/chargeRule',a,'GET',undefined,{'tenant-id':String(tenants[foreign]),user_id:'1'});
   assert.equal(Number(rule.tenant_id),tenants[i]);
   const before=snapshot(tenants[i]);
   const denied=await req('hcp-mp/order/saveOrder?'+new URLSearchParams({portId:fixtures[foreign].port,userId:members[foreign].id,amount:50,hour:1}),null,'GET',undefined,{token:'Bearer '+members[i].token});
   assert.notEqual(denied.code,200);assert.equal(snapshot(tenants[i]),before);
  }
  pass('symmetric tenant spoof rules and device-parent denial');
  let rule=await ok('operator/chargeRule',admins[0]);
  await ok('operator/chargeRule',admins[0],'PUT',{maxChargingHours:2,whitelistEnabled:true,version:rule.version});
  await deny('operator/chargeRule',admins[0],'PUT',{maxChargingHours:1,whitelistEnabled:false,version:rule.version});
  const before=snapshot(tenants[0]);
  await deny('hcp-mp/order/saveOrder?'+new URLSearchParams({portId:fixtures[0].port,userId:members[0].id,amount:50,hour:1}),null,'GET',undefined,{token:'Bearer '+members[0].token});
  assert.equal(snapshot(tenants[0]),before);
  rule=await ok('operator/chargeRule',admins[0]);
  await deny('operator/chargeRule/member',admins[0],'POST',{memberId:members[1].id,version:rule.version});
  await ok('operator/chargeRule/member',admins[0],'POST',{memberId:members[0].id,version:rule.version});
  await deny('hcp-mp/order/saveOrder?'+new URLSearchParams({portId:fixtures[0].port,userId:members[0].id,amount:50,hour:3}),null,'GET',undefined,{token:'Bearer '+members[0].token});
  assert.equal(snapshot(tenants[0]),before);
  pass('whitelist duration stale-version and no-side-effect guards');
  for(const change of ['status=1',"tenant_time='2020-01-01'"]) {
   sql(`UPDATE sys_tenant SET ${change} WHERE id=${tenants[0]}`);
   const blockedLogin=await form('login',{username:members[0].username,password});
   assert.notEqual(blockedLogin.code,200);assert.match(blockedLogin.msg,/运营商已停用或到期/);
   await assert.rejects(()=>login(accountName(0),password));
   const stoppedRegister=await form('register',{username:'blocked_'+tenants[0],password,mobile:'137'+String(tenants[0]).slice(-8),code:'000000',tenantCode:tenants[0]});
   assert.notEqual(stoppedRegister.code,200);
   assert.match(stoppedRegister.msg,/运营商已停用或到期/);
   await deny('hcp-mp/order/saveOrder?'+new URLSearchParams({portId:fixtures[0].port,userId:members[0].id,amount:50,hour:1}),null,'GET',undefined,{token:'Bearer '+members[0].token});
   assert.equal(snapshot(tenants[0]),before);
   sql(`UPDATE sys_tenant SET status=0,tenant_time='2027-12-31' WHERE id=${tenants[0]}`);
  }
  pass('disabled and expired tenant entry guards');
  for(let i=0;i<2;i++) {
   const m=members[i],f=fixtures[i];
   const order=await mp('saveOrder',m,{portId:f.port,userId:m.id,amount:50,hour:1});online.push(f.pile);
   const ownOrders=await ok('operator/order/list?pileId='+f.pile,admins[i]);
   assert(ownOrders.some(o=>o.orderId===order.orderId),'Operator cannot see own tenant member order');
   const foreignOrders=await ok('operator/order/list?pileId='+f.pile,admins[1-i]);
   assert.equal(foreignOrders.length,0);
   const foreignDetail=await req('operator/order/getOrderByOrderNumber/'+order.orderNumber,admins[1-i]);
   assert(foreignDetail.code!==200 || foreignDetail.data==null,'Foreign backend order detail leaked');
   await until(async()=>{const d=await mp('orderDetail',m,{orderNumber:order.orderNumber});return Number(d.consumePower)>0&&d;},45000);
   await deny('hcp-mp/order/orderDetail?orderNumber='+order.orderNumber,null,'GET',undefined,{token:'Bearer '+members[1-i].token});
   if(i===0) {
    sql(`UPDATE sys_tenant SET status=1 WHERE id=${tenants[i]}`);
    assert.notEqual((await form('login',{username:m.username,password})).code,200);
   }
   await mp('endCharge',m,{pileId:f.pile,port:f.port,orderNumber:order.orderNumber});
   const settled=await until(async()=>{const d=await mp('orderDetail',m,{orderNumber:order.orderNumber});return String(d.orderState)==='3'&&d;},45000);
   assert(Number(settled.consumePower)>0);assert(Number(settled.ordergold)>0);
   assert.equal(sql(`SELECT COUNT(*) FROM c_order_log WHERE order_number=${q(order.orderNumber)} AND brief_info='完成订单'`),'1');
   assert.equal(sql(`SELECT COUNT(*) FROM c_points_event WHERE order_id=${q(order.orderId)}`),'1');
   sql(`UPDATE sys_tenant SET status=0 WHERE id=${tenants[i]}`);
  }
  pass('two full charge settlement flows and stopped-tenant safe stop',{completedOrders:2});
  for(let i=0;i<2;i++) {
   const f=fixtures[i],a=admins[i],m=members[i],other=admins[1-i];
   const reportTicket=await ok('hcp-mp/fault/report',null,'POST',{pileId:f.pile,faultType:'POWER',description:'local test report'}, {token:'Bearer '+m.token});
   const ticket=reportTicket.ticket.id;
   const alarm=await ok('operator/fault/alarms',a,'POST',{eventId:run+'_event_'+i,pileId:f.pile,faultType:'POWER',description:'local test alarm',occurredAt:new Date().toISOString()});
   await until(()=>sql(`SELECT status FROM c_device_alarm_event WHERE id=${Number(alarm.id)}`)==='PROCESSED',60000);
   assert.equal(sql(`SELECT ticket_id FROM c_device_alarm_event WHERE id=${Number(alarm.id)}`),String(ticket));
   await deny('operator/fault/'+ticket,other);
   await deny('operator/fault/alarms/'+alarm.id,other);
   await deny('operator/fault/alarms/'+alarm.id+'/replay',other,'POST');
   for(const route of ['operator/fault/list','operator/fault/alarms']) {
    const hidden=await ok(route+'?pileId='+f.pile,other);
    assert.equal(Number(hidden.total),0,'Foreign fault list leaked');
   }
   await deny('operator/fault/'+ticket+'/action',other,'POST',{action:'ASSIGN',assigneeId:1,note:'denied'});
   const operatorId=Number(sql(`SELECT user_id FROM sys_user WHERE tenant_id=${tenants[i]}`));
   for(const action of ['ASSIGN','START','RESOLVE'])await ok('operator/fault/'+ticket+'/action',a,'POST',{action,assigneeId:operatorId,note:'local verification'});
   await ok('hcp-mp/fault/'+ticket+'/confirm',null,'POST',undefined,{token:'Bearer '+m.token});
   assert.equal(sql(`SELECT status FROM c_fault_ticket WHERE id=${Number(ticket)}`),'CLOSED');
  }
  pass('two alarm-report merges and complete ticket lifecycles',{events:2,closedTickets:2});
  report.success=true;
 } finally {
  for(const pile of online)try{await fetch('http://127.0.0.1:39208/evcs/sim/v1/stop?pileId='+encodeURIComponent(pile),{signal:AbortSignal.timeout(10000)});}catch{}
  if(setup)try{
   cleanup();
   const tables=['sys_user','sys_role','sys_dept','sys_post','c_member','c_menber_balance','c_charging_station','c_charging_pile','c_charging_port','c_charging_order','c_order_log','c_points_event','c_fault_ticket','c_device_alarm_event','c_operator_charge_rule'];
   report.cleanupResidual=Number(sql('SELECT '+tables.map(t=>`(SELECT COUNT(*) FROM ${t} WHERE tenant_id IN(${tenants.join(',')}))`).concat(`(SELECT COUNT(*) FROM sys_tenant WHERE id IN(${tenants.join(',')}))`).join('+')));
   assert.equal(report.cleanupResidual,0);
   report.cleanup='dedicated database fixtures removed';
  }catch(e){report.cleanupError=String(e.message).slice(0,300);report.success=false;process.exitCode=1;}
  for(const token of memberTokens)execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','DEL','member:token:'+token],{stdio:'ignore'});
  for(const token of adminTokens) {
   const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
   execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','DEL','login_tokens:'+payload.user_key],{stdio:'ignore'});
  }
  report.finishedAt=new Date().toISOString();fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
