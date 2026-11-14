const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fillDemoCaptcha}=require('./demo-captcha-helper.cjs');
const root=path.resolve(__dirname,'../site'),out=path.resolve(__dirname,'../outputs/navbar-actions');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname.replace(/^\/site(?=\/|$)/,'');const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'text/html');fs.createReadStream(file).pipe(res)});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.NAVBAR_URL||'http://127.0.0.1:'+server.address().port+'/site/';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>{window.openedProjectLinks=[];window.open=url=>{window.openedProjectLinks.push(url);return null}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.NAVBAR_LIVE==='true'){
   const {execFileSync}=require('child_process'),api='http://127.0.0.1:38080',code=await(await fetch(api+'/code')).json();let answer=execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','GET','captcha_codes:'+code.uuid],{encoding:'utf8'}).trim();try{answer=JSON.parse(answer)}catch{}
   const login=await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123',code:answer,uuid:code.uuid})})).json();assert.equal(login.code,200);await context.addCookies([{name:'Admin-Token',value:login.data.access_token,url:base},{name:'Admin-Tenant',value:'9999',url:base}]);await page.goto(base.replace(/\/$/,'')+'/index');
  }else{await page.goto(base+'#/login');await page.getByPlaceholder('请输入账号').fill('demo');await page.getByPlaceholder('请输入密码').fill('Demo123456!');await fillDemoCaptcha(page);await page.locator('.login-actions button').click();await page.waitForURL('**/#/index')}
  await page.locator('.metric-card').first().waitFor();
  const more=page.locator('.topmenu-container > .el-submenu'),title=more.locator('.el-submenu__title');
  const opened=value=>page.waitForFunction(value=>document.querySelector('.topmenu-container > .el-submenu')?.classList.contains('is-opened')===value,value,{timeout:2500});
  for(const width of [1440,1280,390]){
   await page.setViewportSize({width,height:1000});await title.waitFor();await title.click();await opened(true);await title.click();await opened(false);console.log('PASS '+width+' click opens and second click closes More');
   await title.click();await opened(true);await page.locator('.page-heading').click();await opened(false);console.log('PASS '+width+' outside click closes More');
   await title.click();await opened(true);await page.keyboard.press('Escape');await opened(false);console.log('PASS '+width+' Escape closes More');
   await title.click();await opened(true);await page.locator('.el-menu--popup:visible .el-menu-item').first().click();await opened(false);console.log('PASS '+width+' selecting a menu closes More');
  }
  await page.setViewportSize({width:1440,height:1000});
  const links=[['#vctgo-git','项目仓库','https://github.com/ifox-hu/YUNENG-ChargeOS'],['#vctgo-blog','项目文档','https://github.com/ifox-hu/YUNENG-ChargeOS/blob/master/docs/development-guide.md'],['#vctgo-doc','问题反馈','https://github.com/ifox-hu/YUNENG-ChargeOS/issues']];
  for(const [selector,label,url]of links){const item=page.locator(selector);await item.hover();await page.getByRole('tooltip',{name:label,exact:true}).waitFor();await item.locator('svg').click();const openedLinks=await page.evaluate(()=>window.openedProjectLinks);assert.equal(openedLinks.at(-1),url);console.log('PASS '+label+' opens project URL')}
  await page.mouse.move(1000,350);await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'navbar-fixed.png')});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({base,errors,checkedAt:new Date().toISOString()},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
