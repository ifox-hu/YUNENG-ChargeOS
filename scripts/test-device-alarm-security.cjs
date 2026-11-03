// Real authenticated role/tenant checks; only unique, removable fixtures are written.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {sql,literal:q,request,login,prefix,cleanup}=require('./lib/device-alarm-testkit.cjs');
const run=prefix(),name='qa_alarm_'+crypto.randomBytes(5).toString('hex');
let created=false,checks=0;const tokens=[];
const pass=label=>{checks++;console.log('PASS '+label)};
(async()=>{try{
 sql('INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id) VALUES('+q(run+'_0')+",'alarm security fixture',1,9999),("+q(run+'_1')+",'foreign fixture',1,9998)");created=true;
 sql('INSERT INTO sys_role(role_name,role_key,role_sort,status,tenant_id) VALUES('+q(name)+','+q(name)+",99,'0',9999);");
 sql('INSERT INTO sys_role_menu(role_id,menu_id,tenant_id) SELECT r.role_id,m.menu_id,9999 FROM sys_role r JOIN sys_menu m ON m.perms=\'operator:fault:list\' WHERE r.role_key='+q(name));
 sql('INSERT INTO sys_user(user_name,nick_name,password,status,del_flag,tenant_id,remark) SELECT '+q(name)+",'alarm reader',password,'0','0',9999,"+q(name)+' FROM sys_user WHERE user_id=1');
 sql('INSERT INTO sys_user_role(user_id,role_id,tenant_id) SELECT u.user_id,r.role_id,9999 FROM sys_user u JOIN sys_role r ON r.role_key='+q(name)+' WHERE u.user_name='+q(name));
 const reader=await login(name),admin=await login();tokens.push(reader,admin);
 const ownEvent=run+'-own',otherEvent=run+'-other';
 for(const [event,pile,tenant] of [[ownEvent,run+'_0',9999],[otherEvent,run+'_1',9998]])sql('INSERT INTO c_device_alarm_event(tenant_id,event_id,pile_id,fault_type,priority,description,occurred_at,actor_id,actor_name,status) VALUES('+tenant+','+q(event)+','+q(pile)+",'POWER','NORMAL','security fixture','2026-11-04T00:00:00.000Z',1,'admin','DEAD')");
 const own=Number(sql('SELECT id FROM c_device_alarm_event WHERE event_id='+q(ownEvent))),other=Number(sql('SELECT id FROM c_device_alarm_event WHERE event_id='+q(otherEvent)));
 const api=(token,suffix='',method='GET',body)=>request('operator/fault/alarms'+suffix,token,method,body);
 let r=await api(reader,'?pileId='+run+'_0');assert.equal(r.code,200);assert.equal(r.data.total,1);pass('read-only role can list its own tenant events');
 r=await api(reader,'?pileId='+run+'_1');assert.equal(r.code,200);assert.equal(r.data.total,0);
 assert.notEqual((await api(reader,'/'+other)).code,200);pass('foreign tenant events excluded from list and detail');
 assert.notEqual((await api(reader,'/'+own+'/replay','POST',{})).code,200);pass('read-only role cannot replay even its own DEAD event');
 assert.notEqual((await api(reader,'','POST',{eventId:run+'-forbidden',pileId:run+'_0',faultType:'POWER',description:'not authorized',occurredAt:'2026-11-04T00:00:00Z'})).code,200);pass('read-only role cannot submit alarms');
 // Grant creation, not replay, then login anew so permission cache reflects the new role.
 sql('INSERT INTO sys_role_menu(role_id,menu_id,tenant_id) SELECT r.role_id,m.menu_id,9999 FROM sys_role r JOIN sys_menu m ON m.perms=\'operator:fault:add\' WHERE r.role_key='+q(name));
 const creator=await login(name);tokens.push(creator);
 assert.notEqual((await api(creator,'/'+own+'/replay','POST',{})).code,200);pass('creation permission does not imply replay permission');
 assert.notEqual((await api(creator,'','POST',{eventId:run+'-foreign',pileId:run+'_1',faultType:'POWER',description:'foreign',occurredAt:'2026-11-04T00:00:00Z',tenantId:9998,root:true})).code,200);pass('client-supplied tenant/root fields cannot bypass tenant boundary');
 r=await api(creator,'','POST',{eventId:run+'-identity',pileId:run+'_0',faultType:'OTHER',description:'identity fixture',occurredAt:'2026-11-04T00:00:00Z',actorId:1,actorName:'admin'});assert.equal(r.code,200);
 const actor=sql('SELECT actor_id FROM c_device_alarm_event WHERE id='+Number(r.data.id));assert.equal(actor,sql('SELECT user_id FROM sys_user WHERE user_name='+q(name)));pass('operator identity comes from server-side session, not request');
 assert.equal((await api(admin,'/'+own)).code,200);console.log(JSON.stringify({run,checks,passed:true}));
}finally{
 await Promise.allSettled(tokens.map(token=>request('auth/logout',token,'DELETE')));
 if(created)cleanup(run);
 sql('DELETE ur FROM sys_user_role ur JOIN sys_user u ON u.user_id=ur.user_id WHERE u.user_name='+q(name)+'; DELETE rm FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id WHERE r.role_key='+q(name)+'; DELETE FROM sys_user WHERE user_name='+q(name)+' AND remark='+q(name)+'; DELETE FROM sys_role WHERE role_key='+q(name));
}})().catch(e=>{console.error(e);process.exitCode=1});
