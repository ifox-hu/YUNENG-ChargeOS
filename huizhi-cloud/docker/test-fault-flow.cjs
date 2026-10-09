// Local integration tests. Create and remove only uniquely named QA fixtures.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const base='http://127.0.0.1:8001/prod-api/';
const mp='http://127.0.0.1:38080/hcp-mp/';
const pile='QA_FAULT_'+crypto.randomBytes(6).toString('hex');
const outsider=crypto.randomUUID(), outsiderMember=1007;
const roleKey='qaf_'+crypto.randomBytes(5).toString('hex');
const handlerName=roleKey+'_h', otherName=roleKey+'_o', readerName=roleKey+'_r';
const operatorTokens=[];
const rollbackTrigger='qaf_rollback_'+crypto.randomBytes(5).toString('hex');
let adminToken,memberToken,checks=0;
function sql(query){return execFileSync('docker',['exec','-e','MYSQL_PWD=password','hcp-mysql','mysql','--default-character-set=utf8mb4','-uroot','vctgo_platform','-Nse',query],{encoding:'utf8'}).trim()}
function redis(...args){return execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5',...args],{encoding:'utf8'}).trim()}
function pass(name){checks++;console.log('PASS '+name)}
async function operatorLogin(username){
 const c=await req(base+'code');let code=redis('GET','captcha_codes:'+c.uuid);try{code=JSON.parse(code)}catch{}
 const r=await req(base+'auth/login',{},'POST',{username,password:'admin123',uuid:c.uuid,code});
 assert.equal(r.code,200,JSON.stringify(r));operatorTokens.push(r.data.access_token);return r.data.access_token;
}
async function req(url,headers={},method='GET',data){
 const res=await fetch(url,{method,headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});
 return res.json();
}
const admin=(path,method='GET',data)=>req(base+'operator/fault/'+path,{Authorization:'Bearer '+adminToken},method,data);
const member=(path,method='GET',data,token=memberToken)=>req(mp+'fault/'+path,token?{token:'Bearer '+token}:{},method,data);
async function main(){
 try{
  const captcha=await req(base+'code');
  let code=redis('GET','captcha_codes:'+captcha.uuid);try{code=JSON.parse(code)}catch{}
  const login=await req(base+'auth/login',{},'POST',{username:'admin',password:'admin123',uuid:captcha.uuid,code});
  assert.equal(login.code,200);adminToken=login.data.access_token;
  const ml=await fetch(mp+'v1/auth/account/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'demo',password:'Demo123456!'})}).then(r=>r.json());
  assert.equal(ml.code,200);memberToken=ml.data.token;const memberId=ml.data.member.memberId;
  assert.notEqual(memberId,outsiderMember);
  // Token fixture is isolated and expires; exercise the real ownership check with a different existing member.
  assert.equal(sql('SELECT COUNT(*) FROM c_member WHERE member_id='+outsiderMember),'1');
  redis('SET','member:token:'+outsider,String(outsiderMember),'EX','300');
  sql("INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id,remark) VALUES('"+pile+"','QA fault fixture',1,9999,'isolated fault integration fixture')");
  sql("INSERT INTO sys_role(role_name,role_key,role_sort,status,tenant_id) VALUES('QA handler','"+roleKey+"',99,'0',9999),('QA reader','"+roleKey+"_read',99,'0',9999);");
  sql("INSERT INTO sys_role_menu(role_id,menu_id,tenant_id) SELECT r.role_id,m.menu_id,9999 FROM sys_role r JOIN sys_menu m ON m.perms LIKE 'operator:fault:%' WHERE r.role_key='"+roleKey+"'; INSERT INTO sys_role_menu(role_id,menu_id,tenant_id) SELECT r.role_id,m.menu_id,9999 FROM sys_role r JOIN sys_menu m ON m.perms='operator:fault:list' WHERE r.role_key='"+roleKey+"_read';");
  for(const username of [handlerName,otherName,readerName]){
    sql("INSERT INTO sys_user(user_name,nick_name,password,status,del_flag,tenant_id,remark) SELECT '"+username+"','QA operator',password,'0','0',9999,'"+roleKey+"' FROM sys_user WHERE user_id=1;");
    const role=username===readerName?roleKey+'_read':roleKey;
    sql("INSERT INTO sys_user_role(user_id,role_id,tenant_id) SELECT u.user_id,r.role_id,9999 FROM sys_user u JOIN sys_role r ON r.role_key='"+role+"' WHERE u.user_name='"+username+"';");
  }
  const handlerToken=await operatorLogin(handlerName), otherToken=await operatorLogin(otherName), readerToken=await operatorLogin(readerName);
  const handlerId=Number(sql("SELECT user_id FROM sys_user WHERE user_name='"+handlerName+"'"));
  const op=(token,path,method='GET',data)=>req(base+'operator/fault/'+path,{Authorization:'Bearer '+token},method,data);
  let r=await member('report','POST',{pileId:pile,faultType:'OTHER',description:'QA'},'');
  assert.notEqual(r.code,200);pass('unauthenticated report rejected');
  r=await member('report','POST',{pileId:pile,faultType:'INVALID',description:'QA'});
  assert.notEqual(r.code,200);pass('invalid fault type rejected');
  r=await member('report','POST',{pileId:'QA_MISSING_'+pile,faultType:'OTHER',description:'QA'});
  assert.notEqual(r.code,200);pass('missing device rejected');
  r=await member('report','POST',{pileId:pile,faultType:'OTHER',description:' '});
  assert.notEqual(r.code,200);pass('empty description rejected');
  const body={pileId:pile,faultType:'CONNECTOR',description:'QA parallel repair report',userId:outsiderMember,priority:'HIGH'};
  const results=await Promise.all(Array.from({length:12},()=>member('report','POST',body)));
  results.forEach(x=>assert.equal(x.code,200,JSON.stringify(x)));
  const ids=new Set(results.map(x=>x.data.ticket.id));assert.equal(ids.size,1);
  const id=results[0].data.ticket.id;
  r=await op(readerToken,'list?pileId='+pile);assert.equal(r.code,200);assert.equal(r.data.total,1);
  r=await op(readerToken,'simulate-alarm','POST',{pileId:pile,faultType:'POWER',description:'QA forbidden'});assert.notEqual(r.code,200);
  r=await op(readerToken,id+'/action','POST',{action:'ASSIGN',assigneeId:handlerId,note:'QA forbidden'});assert.notEqual(r.code,200);pass('read-only role cannot create or assign tickets');
  sql("UPDATE c_fault_ticket SET tenant_id=123456789 WHERE id="+id);
  r=await op(handlerToken,String(id));assert.notEqual(r.code,200);
  r=await op(handlerToken,'list?pileId='+pile);assert.equal(r.code,200);assert.equal(r.data.total,0);
  r=await op(handlerToken,'stats');assert.equal(r.code,200);assert.equal(r.data.total,Number(sql('SELECT COUNT(*) FROM c_fault_ticket WHERE tenant_id=9999')));
  sql('UPDATE c_fault_ticket SET tenant_id=9999 WHERE id='+id);pass('operator details, lists and statistics respect tenant scope');
  assert.equal(sql("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id='"+pile+"' AND status<>'CLOSED'"),'1');
  pass('12 concurrent reports create one active ticket');
  assert.equal(sql('SELECT COUNT(*) FROM c_fault_report WHERE ticket_id='+id),'1');
  assert.equal(sql('SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id='+id),'1');
  assert.equal(results[0].data.ticket.priority,'NORMAL');
  assert.equal(sql('SELECT member_id FROM c_fault_report WHERE ticket_id='+id),String(memberId));
  pass('retry idempotency and server-derived member identity');
  let duplicateBlocked=false;
  try{sql("INSERT INTO c_fault_ticket(ticket_no,pile_id,tenant_id,fault_type,source,description) VALUES('QA_DUP_"+pile+"','"+pile+"',9999,'CONNECTOR','USER','QA')")}catch{duplicateBlocked=true}
  assert(duplicateBlocked);pass('database unique constraint blocks duplicate active ticket');
  r=await admin('simulate-alarm','POST',{pileId:pile,faultType:'CONNECTOR',description:'QA simulated device alert'});
  assert.equal(r.code,200);assert.equal(r.data.ticket.id,id);assert.equal(r.data.merged,true);
  assert.equal(sql('SELECT COUNT(*) FROM c_device_alarm WHERE ticket_id='+id),'1');pass('device alert merges with user report');
  r=await member(String(id));assert.equal(r.code,200);assert.equal(r.data.reports,undefined);pass('owner can read progress without exposing other reports');
  r=await member(String(id),'GET',undefined,outsider);assert.notEqual(r.code,200);
  r=await member(id+'/confirm','POST',{},outsider);assert.notEqual(r.code,200);pass('other member cannot read or close ticket');
  r=await member('mine?pageNum=1&pageSize=10');assert.equal(r.code,200);assert(r.data.records.some(t=>t.id===id));pass('member pagination includes owned report');
  r=await admin('list?pageNum=1&pageSize=10&pileId='+pile);assert.equal(r.code,200);assert.equal(r.data.total,1);pass('admin filters and pagination');
  r=await admin('list?pageSize=999');assert.notEqual(r.code,200);pass('pagination bound enforced');
  r=await admin(id+'/action','POST',{action:'RESOLVE',note:'illegal skip'});assert.notEqual(r.code,200);
  r=await member(id+'/confirm','POST',{});assert.notEqual(r.code,200);pass('illegal state jumps rejected');
  const logCount=sql('SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id='+id);
  r=await admin(id+'/action','POST',{action:'ASSIGN',assigneeId:999999999,note:'invalid assignee'});assert.notEqual(r.code,200);
  assert.equal(sql('SELECT status FROM c_fault_ticket WHERE id='+id),'NEW');
  assert.equal(sql('SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id='+id),logCount);pass('failed assignment preserves status and log count');
  r=await admin(id+'/assignees');assert.equal(r.code,200);assert(r.data.some(x=>x.userId===1));pass('assignee list scoped to ticket tenant');
  r=await admin(id+'/action','POST',{action:'ASSIGN',assigneeId:handlerId,note:'QA assignment'});assert.equal(r.code,200);
  r=await op(otherToken,id+'/action','POST',{action:'START',note:'QA unauthorized operator'});assert.notEqual(r.code,200);pass('only assigned operator can start processing');
  r=await op(handlerToken,id+'/action','POST',{action:'START',note:'QA start'});assert.equal(r.code,200);
  const beforeResolveLog=sql('SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id='+id);
  sql("CREATE TRIGGER "+rollbackTrigger+" BEFORE INSERT ON c_fault_ticket_log FOR EACH ROW SET NEW.note=IF(NEW.ticket_id="+id+" AND NEW.action='RESOLVE',NULL,NEW.note)");
  r=await op(handlerToken,id+'/action','POST',{action:'RESOLVE',note:'QA failed transaction'});assert.notEqual(r.code,200);
  assert.equal(sql('SELECT status FROM c_fault_ticket WHERE id='+id),'PROCESSING');
  assert.equal(sql('SELECT resolved_at IS NULL FROM c_fault_ticket WHERE id='+id),'1');
  assert.equal(sql('SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id='+id),beforeResolveLog);
  sql('DROP TRIGGER '+rollbackTrigger);pass('timeline write failure rolls back status and resolution timestamp');
  r=await op(handlerToken,id+'/action','POST',{action:'RESOLVE',note:'QA resolved'});assert.equal(r.code,200,JSON.stringify(r));
  assert.equal(r.data.ticket.status,'RESOLVED');pass('assignment, processing and resolution flow');
  r=await member(id+'/confirm','POST',{});assert.equal(r.code,200);assert.equal(r.data.ticket.status,'CLOSED');pass('reporter confirms closure');
  r=await member(id+'/confirm','POST',{});assert.notEqual(r.code,200);pass('repeated close rejected');
  r=await member('report','POST',body);assert.equal(r.code,200);assert.notEqual(r.data.ticket.id,id);pass('closed ticket releases active key for new fault');
  r=await admin('stats');assert.equal(r.code,200);assert(r.data.total>=2);assert(r.data.byType.length);assert(r.data.trend.length);pass('statistics query uses persisted tickets');
  const attack=await req(base+'operator/fault/internal/mine?memberId='+memberId+'&pageNum=1&pageSize=10',{Authorization:'Bearer '+adminToken,from:'inner'});
  assert.notEqual(attack.code,200);pass('gateway blocks spoofed internal service header');
  console.log('TOTAL '+checks+' checks passed');
 }finally{
  sql('DROP TRIGGER IF EXISTS '+rollbackTrigger);
  sql("START TRANSACTION; DELETE a FROM c_device_alarm a JOIN c_fault_ticket t ON t.id=a.ticket_id WHERE t.pile_id='"+pile+"'; DELETE l FROM c_fault_ticket_log l JOIN c_fault_ticket t ON t.id=l.ticket_id WHERE t.pile_id='"+pile+"'; DELETE r FROM c_fault_report r JOIN c_fault_ticket t ON t.id=r.ticket_id WHERE t.pile_id='"+pile+"'; DELETE FROM c_fault_ticket WHERE pile_id='"+pile+"'; DELETE FROM c_charging_pile WHERE pile_id='"+pile+"' AND remark='isolated fault integration fixture'; COMMIT;");
  redis('DEL','member:token:'+outsider);
  for(const token of operatorTokens)await req(base+'auth/logout',{Authorization:'Bearer '+token},'DELETE');
  sql("START TRANSACTION; DELETE ur FROM sys_user_role ur JOIN sys_user u ON u.user_id=ur.user_id WHERE u.remark='"+roleKey+"' AND u.user_name IN ('"+handlerName+"','"+otherName+"','"+readerName+"'); DELETE FROM sys_user WHERE remark='"+roleKey+"' AND user_name IN ('"+handlerName+"','"+otherName+"','"+readerName+"'); DELETE rm FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id WHERE r.role_key IN ('"+roleKey+"','"+roleKey+"_read'); DELETE FROM sys_role WHERE role_key IN ('"+roleKey+"','"+roleKey+"_read'); COMMIT;");
  if(memberToken)await req(mp+'v1/auth/account/logout',{token:'Bearer '+memberToken},'POST');
  if(adminToken)await req(base+'auth/logout',{Authorization:'Bearer '+adminToken},'DELETE');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
