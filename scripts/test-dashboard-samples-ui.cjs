const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const root = path.resolve(__dirname, '../site'), out = path.resolve(__dirname, '../outputs/dashboard-samples');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site(?=\/|$)/, '');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'text/html');
  fs.createReadStream(file).pipe(res);
});
(async () => {
 fs.mkdirSync(out,{recursive:true}); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.DASHBOARD_URL||'http://127.0.0.1:'+server.address().port+'/site/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#/login');await page.getByPlaceholder('请输入账号').fill('demo');await page.getByPlaceholder('请输入密码').fill('Demo123456!');await fillDemoCaptcha(page);await page.locator('.login-actions button').click();await page.waitForURL('**/#/index');await page.locator('.metric-card').first().waitFor();
 await page.getByText('首页查看经营概览和待办；站点、设备明细及统计导出请进入“经营管理”。',{exact:true}).waitFor();
 const read=()=>page.locator('.overview-page').evaluate(el=>{const vm=el.__vue__;return {sampleId:vm.sampleId,report:JSON.parse(JSON.stringify(vm.report)),station:vm.station}});
 const initial=await read(),stored=await page.evaluate(()=>localStorage.getItem('yuneng-original-ui-demo-v1'));
 let requests=0;page.on('request',r=>{if(/\/(prod-api|demo-api|dev-api)\//.test(r.url()))requests++});
 const values=[];
 for(const name of ['城际快充 · 城区示例','青禾充电 · 校园示例','云港能源 · 园区示例']){
   await page.locator('.sample-selector').click();await page.locator('.el-select-dropdown:visible').getByText(name,{exact:true}).click();
   await page.getByText('示例运营商 · 非实际业务',{exact:true}).waitFor();const state=await read();assert(state.report.sampleOnly);assert(state.report.summary.orders>0&&state.report.summary.net>0);assert.equal(state.report.trend.length,7);assert(state.report.stations.length>=2);assert(state.report.ranking.length>=2);assert(state.report.devices.some(x=>x.count>0));
   assert.equal(await page.locator('.pending-item:not([disabled])').count(),0);values.push(state.report.summary.orders);
   await page.waitForTimeout(600);await page.screenshot({path:path.join(out,state.sampleId+'.png'),fullPage:true});console.log('PASS '+name+' metrics, trend, stations, devices and sample-only pending');
 }
 assert.equal(new Set(values).size,3);
 const stationSelect=page.getByPlaceholder('全部站点');await stationSelect.click();await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first().click();assert.equal((await read()).report.ranking.length,1);console.log('PASS sample station filter');
 await page.locator('.sample-selector').click();await page.locator('.el-select-dropdown:visible').getByText('当前运营商数据',{exact:true}).click();await page.getByText('浏览器模拟数据',{exact:true}).waitFor();const restored=await read();assert.equal(restored.sampleId,'');assert.equal(restored.station,undefined);assert.equal(restored.report.summary.orders,initial.report.summary.orders);assert.equal(await page.evaluate(()=>localStorage.getItem('yuneng-original-ui-demo-v1')),stored);assert.equal(requests,0);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.locator('.sample-selector').click();await page.locator('.el-select-dropdown:visible').getByText('青禾充电 · 校园示例',{exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'mobile-sample.png'),fullPage:true});console.log('PASS restore current data, immutable demo DB, no backend requests/page errors, mobile sample selector');
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({base,samples:3,requests,errors,checkedAt:new Date().toISOString()},null,2));
 } finally {await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});