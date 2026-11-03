// Local simulated-device benchmark. Files below are generated measurements, never preset results.
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {sql,literal:q,request,login,prefix,cleanup,until}=require('./lib/device-alarm-testkit.cjs');
const {summarize}=require('./lib/device-alarm-metrics.cjs');
const argv=process.argv.slice(2);const arg=(key,def)=>{const i=argv.indexOf('--'+key);return i<0?def:argv[i+1]};
const devices=Number(arg('devices',100)),events=Number(arg('events',devices)),concurrency=Number(arg('concurrency',16));
const scenario=arg('scenario','burst'),run=prefix();
const output=path.resolve(arg('output',path.join('outputs','device-alarm-tests',run+'-'+scenario)));
if(![devices,events,concurrency].every(Number.isInteger)||devices<1||devices>10000||events<1||events>100000||concurrency<1||concurrency>128)throw new Error('Invalid benchmark size');
if(!['burst','duplicate','backlog','restart'].includes(scenario))throw new Error('Unknown scenario');
fs.mkdirSync(output,{recursive:true});const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:16*1024*1024});
function records(){const raw=sql("SELECT JSON_OBJECT('id',id,'eventId',event_id,'pileId',pile_id,'status',status,'ticketId',ticket_id,'publishAttempts',publish_attempts,'consumeFailures',consume_failures,'lastError',last_error,'receivedAt',received_at,'processedAt',processed_at,'latencyMs',TIMESTAMPDIFF(MICROSECOND,received_at,processed_at)/1000) FROM c_device_alarm_event WHERE LEFT(pile_id,"+(run.length+1)+")="+q(run+'_')+' ORDER BY id');return raw?raw.split('\n').map(x=>JSON.parse(x)):[]}
async function main(){let brokerStopped=false,created=false;const requests=[];let recoveryAt=null;
 try{
  const hostConfig=JSON.parse(docker('inspect','hcp-operator','--format','{{json .HostConfig}}'));
  const dockerInfo=JSON.parse(docker('info','--format','{{json .}}'));
  save('environment.json',{run,scenario,devices,events,concurrency,command:process.argv.slice(1),startedAt:new Date().toISOString(),host:{platform:os.platform(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},node:process.version,docker:{version:dockerInfo.ServerVersion,cpus:dockerInfo.NCPU,memoryBytes:dockerInfo.MemTotal,operatingSystem:dockerInfo.OperatingSystem},mysqlVersion:sql('SELECT VERSION()'),operator:{memoryLimitBytes:hostConfig.Memory,nanoCpus:hostConfig.NanoCpus,cpuQuota:hostConfig.CpuQuota},operatorImage:docker('inspect','hcp-operator','--format','{{.Image}}').trim(),operatorAlarmConfig:JSON.parse(docker('inspect','hcp-operator','--format','{{json .Config.Env}}')).filter(x=>x.startsWith('HCP_ALARM_')),kind:'local single operator instance; simulated devices; finite batch, not sustained production capacity'});
  const token=await login();
  for(let start=0;start<devices;start+=100){const vals=[];for(let i=start;i<Math.min(devices,start+100);i++)vals.push('('+q(run+'_'+i)+",'alarm benchmark',1,9999,'"+run+"')");sql('INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id,remark) VALUES '+vals.join(','))}created=true;
  if(scenario==='backlog'||scenario==='restart'){docker('stop','hcp-rocketmq-broker');brokerStopped=true;}
  const occurredAt=new Date().toISOString();let index=0;const began=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{
   while(index<events){const n=index++,e=scenario==='duplicate'?0:n,p=scenario==='duplicate'?0:n%devices;
    const body={eventId:run+'-e'+e,pileId:run+'_'+p,faultType:'POWER',description:'isolated '+scenario+' alarm',occurredAt};
    const t=performance.now();let response;
    try{response=await request('operator/fault/alarms',token,'POST',body)}catch(error){response={code:-1,msg:error.message}}
    requests.push({index:n,eventId:body.eventId,pileId:body.pileId,ms:performance.now()-t,ok:response.code===200,response});
   }
  }));
  const seconds=(performance.now()-began)/1000;
  fs.writeFileSync(path.join(output,'requests.jsonl'),requests.map(x=>JSON.stringify(x)).join('\n')+'\n');
  const acceptance=summarize(requests,seconds);save('http-summary.json',acceptance);
  if(brokerStopped){
   const beforeRecovery=records();save('before-recovery.json',beforeRecovery);
   assert.equal(beforeRecovery.filter(e=>e.status==='PROCESSED').length,0,'Broker outage must leave events durable and unprocessed');
   if(scenario==='restart'){docker('restart','hcp-operator');}
   recoveryAt=Date.now();docker('start','hcp-rocketmq-broker');brokerStopped=false;
  }
  const accepted=new Set(requests.filter(r=>r.ok).map(r=>r.eventId));
  let rows;
  await until(async()=>{rows=records();if(rows.some(e=>e.status==='DEAD'))throw new Error('A benchmark event entered DEAD');return rows.length===accepted.size&&rows.every(e=>e.status==='PROCESSED')},600000);
  const allProcessedObservedAt=Date.now();
  save('events.json',rows);
  const sideEffects=JSON.parse(sql("SELECT JSON_OBJECT('alarms',(SELECT COUNT(*) FROM c_device_alarm WHERE LEFT(pile_id,"+(run.length+1)+")="+q(run+'_')+"),'tickets',(SELECT COUNT(*) FROM c_fault_ticket WHERE LEFT(pile_id,"+(run.length+1)+")="+q(run+'_')+"),'logs',(SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE LEFT(pile_id,"+(run.length+1)+")="+q(run+'_')+')))'));
  const mappings=sql("SELECT JSON_OBJECT('eventId',e.event_id,'eventPk',e.id,'ticketId',e.ticket_id,'ticketPile',t.pile_id,'ticketType',t.fault_type,'alarms',COUNT(a.id),'logs',(SELECT COUNT(*) FROM c_fault_ticket_log l WHERE l.ticket_id=e.ticket_id AND l.action IN ('ALARM','MERGE_ALARM'))) FROM c_device_alarm_event e LEFT JOIN c_fault_ticket t ON t.id=e.ticket_id LEFT JOIN c_device_alarm a ON a.event_id=CONCAT('ALARM-',e.id) AND a.ticket_id=e.ticket_id AND a.pile_id=e.pile_id AND a.fault_type=e.fault_type WHERE LEFT(e.pile_id,"+(run.length+1)+")="+q(run+'_')+' GROUP BY e.id,t.pile_id,t.fault_type').split('\n').filter(Boolean).map(x=>JSON.parse(x));
  const expectedUnique=scenario==='duplicate'?1:events,expectedTickets=scenario==='duplicate'?1:Math.min(devices,events);
  const reconciliation={acceptedUnique:accepted.size,expectedUnique,expectedTickets,sideEffects,mappings};save('reconciliation.json',reconciliation);
  assert.equal(acceptance.failed,0,'HTTP failures must not be ignored');assert.equal(accepted.size,expectedUnique);assert.equal(rows.length,expectedUnique);
  for(const row of rows){assert(accepted.has(row.eventId));const m=mappings.find(x=>x.eventPk===row.id);assert(m);assert.equal(m.alarms,1);assert.equal(m.ticketPile,row.pileId);assert.equal(m.ticketType,'POWER');assert.equal(m.logs,rows.filter(x=>x.ticketId===row.ticketId).length)}
  assert.equal(sideEffects.alarms,expectedUnique);assert.equal(sideEffects.logs,expectedUnique);assert.equal(sideEffects.tickets,expectedTickets);
  const window=JSON.parse(sql("SELECT JSON_OBJECT('processingWindowSeconds',TIMESTAMPDIFF(MICROSECOND,MIN(received_at),MAX(processed_at))/1000000) FROM c_device_alarm_event WHERE LEFT(pile_id,"+(run.length+1)+")="+q(run+'_')));
  const processing=summarize(rows.map(x=>({ms:Number(x.latencyMs),ok:true})),Math.max(Number(window.processingWindowSeconds),0.001));
  const summary={run,scenario,devices,events,concurrency,acceptance,processing:{...processing,percentileMethod:'nearest-rank; unique persisted events; received_at to processed_at',rateMeaning:'unique events completed / first receipt to last completion'},recoveryObservedSeconds:recoveryAt?(allProcessedObservedAt-recoveryAt)/1000:null,recoveryMeasurement:'Broker start command began to first polling confirmation all persisted events PROCESSED; includes startup and polling, excludes subsequent reconciliation',reconciliationPassed:true,finishedAt:new Date().toISOString()};save('summary.json',summary);console.log(JSON.stringify(summary));
 }catch(error){save('failure.json',{message:error.message,stack:error.stack});console.error(error);process.exitCode=1}
 finally{if(brokerStopped)docker('start','hcp-rocketmq-broker');if(created){save('final-events.json',records());try{cleanup(run);save('cleanup.json',{passed:true,finishedAt:new Date().toISOString()})}catch(error){save('cleanup.json',{passed:false,message:error.message});throw error}}}
}
main().catch(e=>{console.error(e);process.exitCode=1});
