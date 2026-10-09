const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file, exports, store={token:'qa',user:{memberId:1008}}) {
  const source=fs.readFileSync(path.join(__dirname,'../',file),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*$/gm,'');
  const requests=[],hooks={},messages=[],redirects=[],modals=[];
  const ctx={ref:value=>({value}),reactive:value=>value,getApp:()=>({globalData:{wsurl:'',serverUrl:''}}),request:o=>requests.push(o),
    onLoad:f=>hooks.load=f,onMounted:f=>hooks.mount=f,onShow:f=>hooks.show=f,onUnload:f=>hooks.unload=f,onReachBottom:f=>hooks.bottom=f,onPullDownRefresh:f=>hooks.refresh=f,
    uni:{getStorageSync:k=>store[k],setStorageSync:(k,v)=>store[k]=v,showToast:o=>messages.push(o.title),showModal:o=>modals.push(o),redirectTo:o=>redirects.push(o),getLocation:o=>o.complete({}),stopPullDownRefresh:()=>{},navigateTo:()=>{}},setTimeout:()=>{}};
  vm.createContext(ctx);vm.runInContext(source+'\nthis.state={'+exports.join(',')+'}',ctx);
  return {ctx,state:ctx.state,requests,hooks,messages,redirects,modals,store};
}
let p=load('pages/index/index.vue',['index','stations','loading','loadall','pager','moreText']);
p.state.index(1);p.state.index(1);assert.equal(p.requests.length,1);
p.requests[0].success({data:{code:200,data:{records:[{stationId:1}],total:1}}});p.requests[0].complete();
assert.equal(p.state.loadall.value,true);assert.equal(p.state.loading.value,false);p.hooks.bottom();assert.equal(p.requests.length,1);
p.hooks.refresh();p.requests[1].fail();p.requests[1].complete();assert.equal(p.state.stations.value.length,1,'network failure preserves existing data');
p=load('pages/user/order.vue',['index','orders','loading','loadall','moreText']);p.state.index(1);
p.requests[0].success({data:{code:200,data:{records:[],total:0}}});p.requests[0].complete();
assert.equal(p.state.moreText.value,'暂无订单');assert.equal(p.state.loadall.value,true);
p=load('pages/user/index.vue',['token','user','score','balance','month']);p.hooks.show();assert.equal(p.requests.length,3);
p.requests[0].success({data:{code:200,data:null}});assert.equal(p.state.score.value,0,'null credit response');
p.store.token='';p.store.user='';p.hooks.show();assert.equal(p.state.token.value,'');assert.equal(p.state.balance.value,0);
p=load('pages/station/create.vue',['form','setport','selected','start','starting','times','activetime']);
p.state.form.list=[{portId:2744,state:'Y'},{portId:2745,state:'N'}];p.state.setport(0);assert.equal(p.state.selected.value,'');
p.state.setport(1);p.state.start();p.state.start();assert.equal(p.requests.length,1,'duplicate start blocked');
p.requests[0].complete();assert.equal(p.state.starting.value,false,'network completion unblocks start');
p.requests[0].success({data:{code:500,msg:'模拟桩未启动:存在未结束的普通订单'}});
assert.equal(p.redirects.length,0);assert(p.messages[0].includes('未结束'));
p.requests[0].success({data:{code:200,data:null}});
assert.equal(p.redirects.length,0);assert(!p.messages.includes('成功开启充电'),'empty order must not report success');
p.state.form.stationName='测试站&A';
p.requests[0].success({data:{code:200,data:{orderNumber:'qa-order',portId:2745,pileId:'202312121',hour:1}}});
assert.equal(p.redirects.length,1);
assert(p.redirects[0].url.includes('orderNumber=qa-order'));
assert(p.redirects[0].url.includes('stationName='+encodeURIComponent('测试站&A')));
p.redirects[0].fail();assert(p.modals[0].content.includes('勿重复'));
p.redirects[0].success();assert(p.messages.includes('成功开启充电'));
p=load('pages/station/index.vue',['form','show']);p.state.show({plotId:1});
p.requests[0].success({data:{code:200,data:null}});
assert.equal(p.messages[0],'站点信息暂不可用');assert.equal(p.state.form.fastPileList.length,0);
console.log('PASS page flows: pagination, empty orders, offline preservation, null credit, login refresh, unavailable port, duplicate start, missing station');
