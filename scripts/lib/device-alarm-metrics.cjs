function summarize(samples,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Measured window must be positive');
 const latencies=samples.map(x=>x.ms).sort((a,b)=>a-b);
 const percentile=p=>latencies.length?latencies[Math.max(0,Math.ceil(latencies.length*p)-1)]:null;
 const success=samples.filter(x=>x.ok).length;
 return {requests:samples.length,success,failed:samples.length-success,seconds,successQps:success/seconds,errorRate:samples.length?(samples.length-success)/samples.length:0,p50Ms:percentile(0.5),p95Ms:percentile(0.95),p99Ms:percentile(0.99),percentileMethod:'nearest-rank; all HTTP attempts'};
}
function validateRun(run){if(!/^QA_ALARM_\d+_[a-f0-9]{6}$/.test(run))throw new Error('Unsafe cleanup prefix');return run}
module.exports={summarize,validateRun};
