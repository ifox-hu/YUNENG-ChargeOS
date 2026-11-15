// Capture the built Pages app in a fresh browser context; no backend calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fillDemoCaptcha}=require('./demo-captcha-helper.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../site'),out=path.resolve(process.env.CAPTURE_OUTPUT||path.join(__dirname,'../docs/screenshots/admin'));fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/site(?=\/|$)/,'');const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff':'font/woff','.ttf':'font/ttf'})[path.extname(f)]||'text/html');fs.createReadStream(f).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const base=(process.env.BRAND_URL||'http://127.0.0.1:'+server.address().port+'/site/').replace(/\/?$/,'/');
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),files=[],errors=[],external=[],failed=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)external.push(r.url())});p.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url())});
  async function capture(name,locator){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1100);const filename=name+'-blue-white.png';await(locator||p).screenshot({path:path.join(out,filename),animations:'disabled',...(!locator&&name==='overview'?{fullPage:true}:{})});files.push(filename);console.log('CAPTURE '+name)}
  async function navigate(route,selector){await p.evaluate(async route=>{await document.querySelector('#app').__vue__.$router.push(route)},route);await p.locator(selector).first().waitFor({timeout:30000})}
  await p.goto(base+'#/login');await p.locator('.ec-ready canvas').waitFor({timeout:60000});const title=await p.title();assert.equal((title.match(/驭能智充/g)||[]).length,1,title);assert((await p.locator('link[rel=icon]').getAttribute('href')).includes('yuneng-blue.svg'));await capture('login');
  await p.getByPlaceholder('请输入账号').fill('demo');await p.getByPlaceholder('请输入密码').fill('Demo123456!');await fillDemoCaptcha(p);await p.locator('.login-actions button').click();await p.waitForURL('**/#/index');await p.waitForFunction(()=>{const v=document.querySelector('.operations-dashboard')?.__vue__;return v?.updatedAt&&!v.loading});assert.equal(await p.locator('.shortcut-card').count(),4);await capture('overview');
  for(const[route,name,selector]of[
   ['/operations/statistics','statistics','.app-main .el-form'],['/operations/map','map','[data-testid=station-map] canvas'],['/operations/screen','screen','.data-screen canvas'],['/operate/station','station-list','.el-table__row'],['/operate/order','order-list','.el-table__row'],['/operate/chargeStation','device-list','.port-card'],['/operate/fault','fault-list','.fault-page .metric'],['/operate/balance?tab=finance','finance','.embedded-operations .data-table'],['/operate/member?tab=coupons','marketing','.embedded-operations .data-table']
  ]){await navigate(route,selector);if(name==='screen')assert.equal(await p.locator('.sidebar-container:visible').count(),0);await capture(name)}
  await navigate('/operate/fault','[data-testid=alarm-events]');await capture('alarm-events',p.locator('[data-testid=alarm-events]'));
  await p.goto(base+'#/system/tenant');await p.locator('button').filter({hasText:'运营商开户'}).click();await p.locator('.el-dialog:visible').waitFor();await capture('operator-onboarding');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.equal(files.length,13);
  const indexSha256=createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex');fs.writeFileSync(path.join(out,'capture-manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),source:process.env.BRAND_URL?'published Pages':'current site build',indexSha256,overviewScene:'全部运营商 / 全部站点（浏览器演示样本）',viewport:{width:1440,height:1000},files,errors,external,failed},null,2)+'\n');
  console.log('PASS 13 current screenshots, subdirectory login, four shortcuts, fullscreen screen, existing finance/coupons, no errors or external requests');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
