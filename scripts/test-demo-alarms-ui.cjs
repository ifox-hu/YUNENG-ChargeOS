// Exercise the built Pages artifact locally or at DEMO_URL; browser-only data, no backend.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {fillDemoCaptcha}=require('./demo-captcha-helper.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../site');
let browser,server;
(async()=>{try{
 let base=process.env.DEMO_URL;
 if(!base){
  server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname.replace(/^\/site(?=\/|$)/,'');const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file))});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/site/';
 }
 base=base.replace(/\/?$/,'/');
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1800,height:1100}});
 const errors=[],backend=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(prod-api|demo-api)\//.test(r.url()))backend.push(r.url())});
 await page.goto(base+'#/login');await page.locator('input').first().fill('demo');await page.locator('input[type="password"]').fill('Demo123456!');await fillDemoCaptcha(page);await page.locator('.login-form button').last().click();await page.waitForURL('**/#/index');
 await page.goto(base+'#/operate/fault');const panel=page.locator('[data-testid="alarm-events"]');await panel.waitFor();
 await panel.getByText('静态演示：告警与工单仅保存在当前浏览器',{exact:false}).waitFor();
 const dead=panel.locator('.el-table__row').filter({hasText:'DEMO-ALARM-DEAD'});await dead.getByRole('button',{name:'重放',exact:true}).click();await page.locator('.el-message-box').getByRole('button',{name:'确定',exact:true}).click();
 await page.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1'));const e=d.alarmEvents.find(x=>x.eventId==='DEMO-ALARM-DEAD');return e.status==='PENDING'&&Date.now()>=e.readyAt});
 await panel.getByRole('button',{name:'刷新告警',exact:true}).click();await dead.getByText('已处理',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).alarmEvents.find(x=>x.eventId==='DEMO-ALARM-DEAD').replayAudit.length),1);console.log('PASS Pages failure replay, delayed simulated processing and browser audit');
 const pile=await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).lists['/operator/pile/list'];return String((c.rows||c.data)[0].pileId)});
 await panel.getByRole('button',{name:'新建异步告警',exact:true}).click();const dialog=page.locator('.el-dialog:visible').filter({hasText:'异步告警模拟'});await dialog.getByPlaceholder('告警设备编号').fill(pile);await dialog.locator('textarea').fill('Pages UI acceptance alarm');await dialog.getByRole('button',{name:'提交告警',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const eventId=await page.evaluate(()=>JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).alarmEvents.find(x=>x.description==='Pages UI acceptance alarm').eventId);
 await page.waitForFunction(id=>{const e=JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).alarmEvents.find(x=>x.eventId===id);return Date.now()>=e.readyAt},eventId);
 await panel.getByRole('button',{name:'刷新告警',exact:true}).click();const row=panel.locator('.el-table__row').filter({hasText:eventId});await row.getByText('已处理',{exact:true}).waitFor();await row.getByRole('button',{name:'工单',exact:true}).click();await page.locator('.el-dialog:visible').filter({hasText:'工单详情'}).waitFor();console.log('PASS Pages new simulated alarm and linked ticket details');
 await page.reload();await page.locator('[data-testid="alarm-events"]').waitFor();assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).alarmEvents.filter(x=>x.eventId===id).length,eventId),1);
 assert.deepEqual(errors,[]);assert.deepEqual(backend,[]);await page.locator('[data-testid="alarm-events"]').screenshot({path:path.join(__dirname,'../outputs/pages-alarm-ui.png')});console.log('PASS persistence after reload, subdirectory route, no backend requests or page errors');
}finally{if(browser)await browser.close();if(server)server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
