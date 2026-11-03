const {test}=require('node:test');const assert=require('node:assert/strict');
function metrics(){try{return require('./lib/device-alarm-metrics.cjs')}catch(e){assert.fail('Alarm benchmark statistics are not implemented')}}
test('nearest-rank quantiles and successful request rate use explicit measured window',()=>{
 const r=metrics().summarize([{ms:10,ok:true},{ms:20,ok:false},{ms:30,ok:true},{ms:40,ok:true}],2);
 assert.equal(r.successQps,1.5);assert.equal(r.errorRate,0.25);assert.equal(r.p95Ms,40);assert.equal(r.p50Ms,20);
});
test('no samples or successes do not produce fabricated latency or throughput',()=>{
 assert.equal(metrics().summarize([],1).p95Ms,null);
 const r=metrics().summarize([{ms:12,ok:false}],1);assert.equal(r.successQps,0);assert.equal(r.errorRate,1);
 assert.throws(()=>metrics().summarize([],0));
});
test('cleanup target must be one exact generated run prefix',()=>{
 assert.equal(metrics().validateRun('QA_ALARM_1793725541147_a4d1b2'),'QA_ALARM_1793725541147_a4d1b2');
 for(const bad of ['','QA_ALARM_','%','QA_ALARM_1793725541147_a4d1b2%','../'])assert.throws(()=>metrics().validateRun(bad));
});
