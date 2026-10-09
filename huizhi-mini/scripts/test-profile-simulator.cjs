// Local simulator verification, reads charging data and exercises navigation only.
const assert=require('node:assert/strict');
const automator=require(process.env.MINIPROGRAM_AUTOMATOR || 'miniprogram-automator');
const path=require('node:path');
let mini;
const deadline=setTimeout(()=>{console.error('DevTools automation did not become ready within 60 seconds');process.exit(1)},60000);deadline.unref();
(async()=>{try{
 mini=await automator.launch({cliPath:'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat',projectPath:path.resolve(__dirname,'../unpackage/dist/dev/mp-weixin'),port:9420,timeout:25000});
 const hasToken=await mini.callWxMethod('getStorageSync','token');
 if(!hasToken){
  const login=await fetch('http://127.0.0.1:38080/hcp-mp/v1/auth/account/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'demo',password:'Demo123456!'})}).then(r=>r.json());assert.equal(login.code,200);
  await mini.callWxMethod('setStorageSync','token',login.data.token);await mini.callWxMethod('setStorageSync','user',login.data.member);
 }
 let p=await mini.reLaunch('/pages/user/index');await p.waitFor(1200);
 const entries=await p.$$('.service-item');assert.equal(entries.length,3);
 const dimensions=await Promise.all(entries.map(e=>e.size()));assert(dimensions.every(d=>Number(d.height)<120),'entry is oversized');
 console.log('PASS simulator compact service rows',JSON.stringify(dimensions));
 const cells=await p.$$('.month-cell');assert.equal(cells.length,3);
 const widths=await Promise.all(cells.map(e=>e.size()));assert(Math.max(...widths.map(w=>Number(w.width)))-Math.min(...widths.map(w=>Number(w.width)))<2);
 await mini.screenshot({path:path.resolve(__dirname,'../docs/miniapp/profile-simulator.png')});
 await entries[1].tap();p=await mini.currentPage();assert.equal(p.path,'pages/repair/create');
 await p.waitFor(300);const options=await p.$$('.fault-option');await options[2].tap();assert((await options[2].attribute('class')).includes('fault-selected'));
 await mini.screenshot({path:path.resolve(__dirname,'../docs/miniapp/repair-form-simulator.png')});
 const header=await p.$('page-header');assert(header);await (await header.$('.back-button')).tap();
 assert.equal((await mini.currentPage()).path,'pages/user/index');
 p=await mini.currentPage();await (await p.$$('.service-item'))[2].tap();p=await mini.currentPage();assert.equal(p.path,'pages/repair/list');
 await p.waitFor(500);await (await (await p.$('page-header')).$('.back-button')).tap();assert.equal((await mini.currentPage()).path,'pages/user/index');
 console.log('PASS simulator repair entry, selected fault feedback, record entry and both back buttons');
 }finally{if(mini)mini.disconnect();clearTimeout(deadline)}
})().catch(e=>{console.error(e.message);process.exitCode=1});
