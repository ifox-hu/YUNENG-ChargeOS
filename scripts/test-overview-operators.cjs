const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const load=async()=>{
 const read=file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(file,'utf8')).toString('base64'));
 return {model:await read('yuneng-admin/src/utils/operations-overview.js'),samples:await read('yuneng-admin/src/demo/dashboard-samples.js')};
};
test('all operators equals separate details, including trends, money, devices and pending',async()=>{
 const {model,samples}=await load(),query={from:'2026-11-09',to:'2026-11-15'},now=new Date(2026,10,15);
 const entries=samples.dashboardSamples.map(row=>({id:row.id,name:row.name,report:samples.getDashboardSample(row.id,query,now)})),before=JSON.stringify(entries);
 const all=model.mergeOperatorOverviews(entries);assert(all.allOperators&&all.sampleOnly);assert.equal(all.operators.length,3);assert.equal(all.stations.length,9);assert.equal(all.devices.reduce((s,r)=>s+r.count,0),108);
 for(const key of Object.keys(all.summary)){const sum=entries.reduce((s,r)=>s+r.report.summary[key],0);assert(Math.abs(all.summary[key]-sum)<0.000001,key)}
 assert.equal(all.trend.length,7);assert.equal(all.trend.reduce((s,r)=>s+r.orders,0),all.summary.orders);assert.equal(all.pending.faults,6);
 assert.equal(JSON.stringify(entries),before);assert.equal(all.tenantId,null);assert(all.ranking.every(row=>row.name.includes(' / ')));
});
test('empty platform remains genuinely empty; sample and business reports are not implicitly mixed',async()=>{
 const {model}=await load(),all=model.mergeOperatorOverviews([]);assert.equal(all.summary.orders,0);assert.equal(all.sampleOnly,false);assert.deepEqual(all.operators,[]);assert.deepEqual(all.trend,[]);
});
test('operator directory consumes all pages for actual and browser demo response formats',async()=>{
 const {model}=await load();for(const shape of ['page','array','rows']){const seen=[];const result=await model.loadOverviewOperators(async query=>{seen.push(query);const records=query.pageNum===1?[{id:9999,tenantName:'甲'}]:[{tenantId:10000,companyName:'乙'}];return shape==='page'?{data:{records,total:2}}:shape==='array'?{data:records,total:2}:{rows:records,total:2}});assert.deepEqual(result,[{id:'9999',name:'甲'},{id:'10000',name:'乙'}]);assert.deepEqual(seen.map(q=>q.pageNum),[1,2])}
});
test('incomplete, repeated or malformed operator pages fail instead of showing partial totals',async()=>{
 const {model}=await load();await assert.rejects(model.loadOverviewOperators(async()=>({data:[],total:1})));await assert.rejects(model.loadOverviewOperators(async()=>({data:[{id:9999}],total:2})));await assert.rejects(model.loadOverviewOperators(async()=>({data:{}})));
});

async function overviewComponent(userId,query={},overrides={}){
 const vm=require('node:vm'),Vue=require('../yuneng-admin/node_modules/vue/dist/vue.common.js');
 const {model,samples}=await load(),calls=[];
 const report=samples.getDashboardSample('sample-city',{},new Date(2026,10,15));delete report.sampleOnly;
 const sandbox={OperationChart:{},dashboardSamples:samples.dashboardSamples,getDashboardSample:samples.getDashboardSample,...model,process:{env:{}},formatMoney:String,getTenant:()=>'',
 listTenant:async()=>{calls.push('directory');return{data:[{id:9999,tenantName:'测试运营商'}],total:1}},getOperations:async(resource,params)=>{calls.push(params);return{data:{...report,tenantId:params.targetTenantId||9999}}},...overrides};
 const script=fs.readFileSync('yuneng-admin/src/views/operator/operations/overview.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInNewContext(script.replace(/^import .*$/gm,'').replace('export default','component ='),sandbox);
 const component=new Vue({...sandbox.component,created(){},beforeCreate(){this.$route={query};this.$store={getters:{userId,permissions:['*:*:*']},state:{user:{id:userId}}};this.$message={warning:()=>{}}}});component.range=['2026-11-09','2026-11-15'];return{component,calls};
}
test('operator account never requests directory or honors another tenant from URL',async()=>{
 const {component,calls}=await overviewComponent(42,{targetTenantId:'12345'});await component.load();assert.equal(component.isPlatform,false);assert.equal(component.allOperators,false);assert.equal(calls.length,1);assert.equal(calls[0].targetTenantId,undefined);assert.equal(component.report.tenantId,9999);component.$destroy();
});
test('platform all uses every actual tenant; a failed tenant never yields a partial total',async()=>{
 const {component,calls}=await overviewComponent(1);await component.load();assert(component.report.allOperators);assert.equal(component.report.operators[0].id,'9999');assert(calls.includes('directory'));assert.equal(calls[1].targetTenantId,'9999');component.$destroy();
 const failing=await overviewComponent(1,{}, {listTenant:async()=>({data:[{id:9999},{id:10000}],total:2}),getOperations:async()=>{throw Error('某运营商报表失败')}});await failing.component.load();assert.equal(failing.component.report,null);assert.equal(failing.component.error,'某运营商报表失败');failing.component.$destroy();
});
test('local legacy demo identity remains visible without inventing a registered operator',async()=>{
 const {component,calls}=await overviewComponent(1,{}, {getTenant:()=>9999,listTenant:async()=>({data:[{id:101,tenantName:'已登记运营商'}],total:1})});await component.load();assert.equal(component.report.operators.length,2);assert.equal(component.operators[1].id,'9999');assert.equal(component.operators[1].name,'本地演示运营商（9999）');assert.equal(calls.length,2);assert.equal(calls[1].targetTenantId,'9999');component.$destroy();
});
