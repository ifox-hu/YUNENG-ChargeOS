const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../components/page-header/index.vue'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1];
function header(depth,dirty=false){
 const events=[],modals=[];
 const ctx={defineProps:()=>({title:'测试',fallback:'/pages/user/index',confirmLeave:dirty}),
 getCurrentPages:()=>Array.from({length:depth},()=>({})),
 uni:{getWindowInfo:()=>({statusBarHeight:24,windowWidth:390}),getMenuButtonBoundingClientRect:()=>({top:28,height:32,left:285}),
 navigateBack:o=>events.push({type:'back',...o}),reLaunch:o=>events.push({type:'fallback',...o}),showModal:o=>modals.push(o)}};
 vm.createContext(ctx);vm.runInContext(source+';this.state={back,navHeight,statusHeight,titleInset}',ctx);return {state:ctx.state,events,modals};
}
let h=header(2);h.state.back();assert.equal(h.events[0].delta,1);h.events[0].fail();assert.equal(h.events[1].url,'/pages/user/index');
h=header(1);h.state.back();assert.equal(h.events[0].type,'fallback');
h=header(2,true);h.state.back();assert.equal(h.events.length,0);h.modals[0].success({confirm:false});assert.equal(h.events.length,0);h.modals[0].success({confirm:true});assert.equal(h.events[0].type,'back');
assert(h.state.navHeight>=44);assert.equal(h.state.statusHeight,24);assert(h.state.titleInset>=105);
console.log('PASS back: previous page, root fallback, navigation failure fallback, unsaved form cancel/confirm, capsule insets');
const userSource=fs.readFileSync(path.resolve(__dirname,'../pages/user/index.vue'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*$/gm,'');
const requests=[],navigation=[],store={token:'qa',user:{memberId:1008}},hooks={};
const ctx={ref:value=>({value}),reactive:value=>value,getApp:()=>({}),onShow:f=>hooks.show=f,request:o=>requests.push(o),
 uni:{getStorageSync:k=>store[k],navigateTo:o=>navigation.push(o.url),showToast:()=>{}}};
vm.createContext(ctx);vm.runInContext(userSource+';this.state={goabort,getmonth,formatValue,statsLoading,statsError,month}',ctx);
hooks.show();assert.equal(requests.length,3);ctx.state.getmonth();assert.equal(requests.length,3);
requests[2].fail();requests[2].complete();assert.equal(ctx.state.statsLoading.value,false);assert(ctx.state.statsError.value.includes('网络'));
ctx.state.getmonth();requests[3].success({data:{code:200,data:{chargeDegree:0,chargeAmount:4.8,chargeTime:0}}});requests[3].complete();
assert.equal(ctx.state.formatValue(ctx.state.month.chargeAmount,2),'4.80');
ctx.state.goabort('/pages/repair/create');assert.equal(navigation[0],'/pages/repair/create');
store.token='';hooks.show();ctx.state.goabort('/pages/repair/list');assert.equal(navigation[1],'/pages/user/login');
console.log('PASS profile: entry navigation, login routing, stats refresh loading/retry and value formatting');

