const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const {sql,literal:q,login,request,prefix,cleanup,until}=require('./lib/device-alarm-testkit.cjs');
const run=prefix();const output=path.join('outputs','device-alarm-tests',run+'-mq-duplicates');fs.mkdirSync(output,{recursive:true});
const count=Number(process.argv[2]||1000);let created=false;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:16*1024*1024,timeout:240000});
(async()=>{try{
 const token=await login();sql('INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id) VALUES('+q(run+'_0')+",'MQ alarm fixture',1,9999)");created=true;
 const r=await request('operator/fault/alarms',token,'POST',{eventId:run+'-event',pileId:run+'_0',faultType:'POWER',description:'MQ repeat fixture',occurredAt:new Date().toISOString()});assert.equal(r.code,200,JSON.stringify(r));
 const id=Number(r.data.id);await until(()=>sql('SELECT status FROM c_device_alarm_event WHERE id='+id)==='PROCESSED');
 docker('cp','scripts/AlarmDuplicateProbe.java','hcp-rocketmq-broker:/tmp/AlarmDuplicateProbe.java');
 docker('exec','hcp-rocketmq-broker','sh','-c','mkdir -p /tmp/alarm-probe && javac -cp "/home/rocketmq/rocketmq-4.9.7/lib/*" -d /tmp/alarm-probe /tmp/AlarmDuplicateProbe.java');
 const raw=docker('exec','hcp-rocketmq-broker','java','-Xms32m','-Xmx96m','-cp','/tmp/alarm-probe:/home/rocketmq/rocketmq-4.9.7/lib/*','AlarmDuplicateProbe',String(id),String(count));
 fs.writeFileSync(path.join(output,'probe.log'),raw);
 const probe=raw.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).find(x=>x.realMessagesSent);
 assert(probe);assert.equal(probe.realMessagesSent,count);assert.equal(probe.allTargetOffsetsConsumed,true);
 const result=JSON.parse(sql("SELECT JSON_OBJECT('events',(SELECT COUNT(*) FROM c_device_alarm_event WHERE id="+id+"),'alarms',(SELECT COUNT(*) FROM c_device_alarm WHERE event_id="+q('ALARM-'+id)+"),'tickets',(SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id="+q(run+'_0')+"),'logs',(SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id="+q(run+'_0')+")))"));
 assert.deepEqual(result,{events:1,alarms:1,tickets:1,logs:1});
 const summary={run,...probe,reconciliation:result,passed:true};fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:e.message,stack:e.stack},null,2));throw e}finally{if(created)cleanup(run)}})().catch(e=>{console.error(e);process.exitCode=1});
