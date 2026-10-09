// Isolated page logic checks, not a substitute for DevTools/phone validation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function page(name,names){
 const source=fs.readFileSync(path.join(__dirname,'../pages/repair/'+name+'.vue'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
 const hooks={},requests=[],messages=[],navigation=[],modals=[],store={token:'test-token'};
 const ctx={ref:value=>({value}),reactive:value=>value,onLoad:fn=>hooks.load=fn,onShow:fn=>hooks.show=fn,onPullDownRefresh:fn=>hooks.refresh=fn,
  faultTypes:[{value:'OFFLINE',label:'设备离线'},{value:'CONNECTOR',label:'充电枪故障'}],
  faultRequest:(url,method,data)=>new Promise((resolve,reject)=>requests.push({url,method,data,resolve,reject})),
  uni:{getStorageSync:k=>store[k],navigateTo:o=>navigation.push(o),redirectTo:o=>navigation.push(o),showToast:o=>messages.push(o.title),
   scanCode:o=>ctx.scan=o,showModal:o=>modals.push(o),stopPullDownRefresh:()=>{}}};
 vm.createContext(ctx);vm.runInContext(source+'\nthis.state={'+names.join(',')+'}',ctx);return {state:ctx.state,ctx,hooks,requests,messages,navigation,modals,store};
}
(async()=>{
 let p=page('create',['form','typeIndex','submitting','parsePile','submit','scan']);
 assert.equal(p.state.parsePile('202312121'),'202312121');
 assert.equal(p.state.parsePile('https://example.test/charge?pileId=202312121'),'202312121');
 assert.throws(()=>p.state.parsePile('https://unknown.test/no-id'));
 await p.state.submit();assert.equal(p.requests.length,0);assert(p.messages[0].includes('填写'));
 p.state.form.pileId='202312121';p.state.form.description='QA device offline';
 const submit=p.state.submit();await p.state.submit();assert.equal(p.requests.length,1);
 p.requests[0].reject(new Error('故障服务不可用'));await submit;assert.equal(p.state.submitting.value,false);assert.equal(p.navigation.length,0);
 const retry=p.state.submit();p.requests[1].resolve({merged:true,ticket:{id:12}});await retry;
 assert(p.navigation[0].url.endsWith('id=12'));assert(p.messages.includes('已合并到现有工单'));
 console.log('PASS repair form: QR parsing, validation, duplicate submit, network retry, merged result navigation');
 p=page('list',['rows','page','total','loading','error','load']);
 let loading=p.state.load(true);p.requests[0].resolve({records:[{id:1}],total:2});await loading;
 loading=p.state.load(false);p.requests[1].reject(new Error('network offline'));await loading;
 assert.equal(p.state.page.value,1);assert.equal(p.state.rows.value.length,1);assert.equal(p.state.loading.value,false);
 loading=p.state.load(false);p.requests[2].resolve({records:[{id:2}],total:2});await loading;
 assert.equal(p.state.page.value,2);assert.equal(p.state.rows.value.length,2);
 p.store.token='';await p.state.load(true);assert.equal(p.state.rows.value.length,0);assert(p.navigation[0].url.includes('login'));
 console.log('PASS repair list: pagination retry does not skip page, login loss clears records');
 p=page('detail',['id','detail','loading','confirming','error','load','confirm']);p.hooks.load({id:'12'});
 loading=p.state.load();p.requests[0].resolve({ticket:{id:12,status:'RESOLVED'},logs:[]});await loading;
 p.state.confirm();let confirming=p.modals[0].success({confirm:false});await confirming;assert.equal(p.requests.length,1);
 p.state.confirm();confirming=p.modals[1].success({confirm:true});assert.equal(p.state.confirming.value,true);
 p.requests[1].resolve({ticket:{id:12,status:'CLOSED'},logs:[]});await confirming;
 assert.equal(p.state.detail.value.ticket.status,'CLOSED');assert.equal(p.state.confirming.value,false);
 console.log('PASS repair detail: server progress refresh, cancel and confirmation closure');
})().catch(e=>{console.error(e);process.exitCode=1});

