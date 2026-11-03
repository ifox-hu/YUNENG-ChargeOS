const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const base=process.env.ALARM_BASE_URL||'http://127.0.0.1:8001/prod-api/';
function sql(query){return execFileSync('docker',['exec','-e','MYSQL_PWD=password','hcp-mysql','mysql','--default-character-set=utf8mb4','-uroot','vctgo_platform','-Nse',query],{encoding:'utf8',maxBuffer:32*1024*1024}).trim()}
function literal(value){return "'"+String(value).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'"}
async function request(path,token,method='GET',body){
 const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const raw=await r.text();try{return JSON.parse(raw)}catch{throw new Error('HTTP '+r.status+' '+raw.slice(0,150))}
}
async function login(username='admin',password='admin123'){
 const c=await request('code');
 let code=execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','GET','captcha_codes:'+c.uuid],{encoding:'utf8'}).trim();
 try{code=JSON.parse(code)}catch{}
 const r=await request('auth/login',null,'POST',{username,password,uuid:c.uuid,code});
 if(r.code!==200) throw new Error('Login failed: '+JSON.stringify(r));return r.data.access_token;
}
function prefix(){return 'QA_ALARM_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex')}
function cleanup(run){
 require('./device-alarm-metrics.cjs').validateRun(run);
 const own="LEFT(pile_id,"+(run.length+1)+")="+literal(run+'_');
 const ids='SELECT id FROM c_fault_ticket WHERE '+own;
 // Lock the same event rows as the consumer before removing dependent data, in one transaction.
 sql('START TRANSACTION; SELECT id FROM c_device_alarm_event WHERE '+own+' FOR UPDATE; '
  +'DELETE FROM c_device_alarm_event_audit WHERE event_pk IN (SELECT id FROM c_device_alarm_event WHERE '+own+'); '
  +'DELETE FROM c_device_alarm_event WHERE '+own+'; '
  +'DELETE FROM c_fault_ticket_log WHERE ticket_id IN ('+ids+'); DELETE FROM c_device_alarm WHERE ticket_id IN ('+ids+'); DELETE FROM c_fault_report WHERE ticket_id IN ('+ids+'); '
  +'DELETE FROM c_fault_ticket WHERE '+own+'; DELETE FROM c_charging_pile WHERE '+own+'; COMMIT;');
}
async function until(fn,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,500))}throw new Error('Timed out waiting for alarm processing')}
module.exports={sql,literal,request,login,prefix,cleanup,until};
