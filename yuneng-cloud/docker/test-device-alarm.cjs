const assert=require('node:assert/strict');
const {sql,literal:q,request,login,prefix,cleanup,until}=require('../../scripts/lib/device-alarm-testkit.cjs');
const run=prefix();let created=false;let checks=0;
const pass=name=>{checks++;console.log('PASS '+name)};
async function main(){
 const token=await login();
 const api=(path='',method='GET',body)=>request('operator/fault/alarms'+path,token,method,body);
 // First run against the previous deployment: expected RED at the missing route.
 const available=await api();assert.equal(available.code,200,'Alarm event API is not implemented: '+JSON.stringify(available));
 try{
  for(let i=0;i<3;i++)sql('INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id,remark) VALUES('+q(run+'_'+i)+",'alarm test',1,"+(i===2?9998:9999)+",'isolated alarm fixture')");
  created=true;
  const body={eventId:run+'-event',pileId:run+'_0',faultType:'POWER',description:'integration alarm',occurredAt:'2026-11-04T00:00:00.123Z'};
  let r=await api('','POST',body);assert.equal(r.code,200,JSON.stringify(r));const id=r.data.id;
  assert(['PENDING','PUBLISHING','SENT','PROCESSED'].includes(r.data.status));pass('durable asynchronous acceptance');
  const duplicates=await Promise.all(Array.from({length:16},()=>api('','POST',body)));
  duplicates.forEach(x=>{assert.equal(x.code,200,JSON.stringify(x));assert.equal(Number(x.data.id),Number(id));assert.equal(x.data.duplicate,true)});
  assert.equal(sql('SELECT COUNT(*) FROM c_device_alarm_event WHERE event_id='+q(body.eventId)),'1');pass('concurrent retries reuse stable event identity');
  for(const change of [{description:'conflict'},{pileId:run+'_1'},{faultType:'OTHER'},{priority:'HIGH'},{occurredAt:'2026-11-04T00:00:01Z'}]){
   r=await api('','POST',{...body,...change});assert.notEqual(r.code,200,'immutable event collision accepted');
  }pass('same key different payload rejected');
  r=await request('operator/fault/alarms',null,'POST',body);assert.notEqual(r.code,200);pass('anonymous intake rejected');
  for(const change of [{eventId:''},{faultType:'BOGUS'},{priority:'URGENT'},{occurredAt:'yesterday'}]){r=await api('','POST',{...body,...change});assert.notEqual(r.code,200)}pass('invalid input rejected');
  await until(async()=>{const x=await api('/'+id);return x.data&&x.data.status==='PROCESSED'});
  const ticket=Number(sql('SELECT ticket_id FROM c_device_alarm_event WHERE id='+Number(id)));
  assert.equal(sql('SELECT COUNT(*) FROM c_device_alarm WHERE event_id='+q('ALARM-'+id)),'1');pass('one alarm association per event');
  r=await api('','POST',{...body,eventId:run+'-new'});const second=r.data.id;
  await until(async()=>{const x=await api('/'+second);return x.data&&x.data.status==='PROCESSED'});
  assert.equal(Number(sql('SELECT ticket_id FROM c_device_alarm_event WHERE id='+second)),ticket);pass('different events of same fault merge into one active ticket');
  r=await api('','POST',{...body,eventId:run+'-other-device',pileId:run+'_1'});const third=r.data.id;
  await until(async()=>{const x=await api('/'+third);return x.data&&x.data.status==='PROCESSED'});
  assert.notEqual(Number(sql('SELECT ticket_id FROM c_device_alarm_event WHERE id='+third)),ticket);pass('different devices produce different tickets');
  r=await api('/'+id+'/replay','POST',{});assert.notEqual(r.code,200);pass('processed event cannot be manually replayed');
  sql("UPDATE c_fault_ticket SET status='CLOSED',closed_at=NOW() WHERE id="+ticket);
  r=await api('','POST',body);assert.equal(Number(r.data.ticketId),ticket);
  assert.equal(sql('SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id='+q(run+'_0')),'1');pass('old event after close does not reopen');
  r=await api('','POST',{...body,eventId:run+'-after-close'});const fourth=r.data.id;
  await until(async()=>{const x=await api('/'+fourth);return x.data&&x.data.status==='PROCESSED'});
  assert.notEqual(Number(sql('SELECT ticket_id FROM c_device_alarm_event WHERE id='+fourth)),ticket);pass('new event after close may create new ticket');
  console.log(JSON.stringify({run,checks,passed:true}));
 }finally{if(created)cleanup(run)}
}
main().catch(e=>{console.error(e);process.exitCode=1});
