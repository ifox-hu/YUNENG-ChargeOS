const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
async function handler(){const file=path.join(__dirname,'../yuneng-admin/src/demo/alarms.js');assert(fs.existsSync(file),'Static alarm event handling is not implemented');return (await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(file,'utf8')).toString('base64'))).handleDemoAlarms}
const start=1700000000000;
const state=()=>({lists:{'/operator/pile/list':{data:[{pileId:'PILE-A',name:'Device A'},{pileId:'PILE-B',name:'Device B'}]}},faults:[],alarmCount:0,alarmEvents:[],alarmEventsVersion:1});
const input=(eventId='event-a',pileId='PILE-A')=>({eventId,pileId,faultType:'POWER',priority:'NORMAL',description:'power fault',occurredAt:'2026-11-04T00:00:00.000Z'});
const endpoint='/operator/fault/alarms';
test('accepted event stays pending first, completes on refresh, and duplicate retries have one side effect',async()=>{
 const run=await handler(),db=state(),a=run(db,endpoint,'post',input(),{},start);assert.equal(a.code,200);assert.equal(a.data.status,'PENDING');assert.equal(db.faults.length,0);
 assert.equal(run(db,endpoint,'get',{}, {},start+500).data.records[0].status,'PENDING');
 const completed=run(db,endpoint,'get',{}, {},start+2000);assert.equal(completed.data.records[0].status,'PROCESSED');assert.equal(db.faults.length,1);assert.equal(db.faults[0].logs.length,1);
 const repeated=run(db,endpoint,'post',input(),{},start+3000);assert.equal(repeated.data.duplicate,true);assert.equal(repeated.data.id,a.data.id);assert.equal(db.alarmEvents.length,1);assert.equal(db.faults[0].logs.length,1);
});
test('immutable event conflicts and nonexistent devices are rejected without inserting records',async()=>{
 const run=await handler(),db=state();run(db,endpoint,'post',input(),{},start);
 assert.equal(run(db,endpoint,'post',{...input(),description:'changed'}, {},start).code,409);
 assert.notEqual(run(db,endpoint,'post',input('missing','NO-SUCH-DEVICE'),{},start).code,200);assert.equal(db.alarmEvents.length,1);
});
test('same device fault merges, different device does not, old event never reopens a closed ticket',async()=>{
 const run=await handler(),db=state();run(db,endpoint,'post',input(),{},start);run(db,endpoint,'post',input('event-b'),{},start);run(db,endpoint,'post',input('event-c','PILE-B'),{},start);
 run(db,endpoint,'get',{}, {},start+2000);assert.equal(db.faults.length,2);const ticket=db.faults.find(t=>t.pileId==='PILE-A');assert.equal(ticket.logs.length,2);ticket.status='CLOSED';
 run(db,endpoint,'post',input(),{},start+3000);assert.equal(db.faults.length,2);
 run(db,endpoint,'post',input('new-after-close'),{},start+3000);run(db,endpoint,'get',{}, {},start+5000);assert.equal(db.faults.length,3);
});
test('only DEAD events can replay, with audit and original immutable identity preserved',async()=>{
 const run=await handler(),db=state();const first=run(db,endpoint,'post',input(),{},start).data;first.status='DEAD';first.lastError='demonstration failure';
 const replay=run(db,endpoint+'/'+first.id+'/replay','post',{}, {},start+1);assert.equal(replay.code,200);assert.equal(replay.data.status,'PENDING');assert.equal(replay.data.eventId,'event-a');assert.equal(replay.data.replayAudit.length,1);
 assert.equal(run(db,endpoint+'/'+first.id+'/replay','post',{}, {},start+2).code,409);run(db,endpoint,'get',{}, {},start+2000);assert.equal(first.status,'PROCESSED');assert.equal(db.faults.length,1);
});
test('existing local browser data gets example events without losing saved tickets',async()=>{
 const run=await handler(),db=state();delete db.alarmEvents;delete db.alarmEventsVersion;db.faults.push({id:7,pileId:'PILE-A',faultType:'OFFLINE',status:'NEW',logs:[]});
 const first=run(db,endpoint,'get',{}, {},start);assert.equal(first.code,200);assert(first.data.records.some(e=>e.status==='DEAD'));assert.equal(db.faults[0].id,7);
 const count=db.alarmEvents.length;run(db,endpoint,'get',{}, {},start);assert.equal(db.alarmEvents.length,count);
});
test('query filtering, pagination and invalid event input follow the page contract',async()=>{
 const run=await handler(),db=state();run(db,endpoint,'post',input(),{},start);run(db,endpoint,'post',input('event-b','PILE-B'),{},start);
 const list=run(db,endpoint,'get',{}, {pileId:'PILE-A',status:'PENDING',pageNum:1,pageSize:10},start);assert.equal(list.data.total,1);assert.equal(list.data.records[0].pileId,'PILE-A');
 assert.notEqual(run(db,endpoint,'post',{...input('invalid'),faultType:'INVALID'}, {},start).code,200);assert.equal(db.alarmEvents.length,2);
});
