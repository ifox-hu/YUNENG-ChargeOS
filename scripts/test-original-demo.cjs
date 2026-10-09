const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../site');
(async()=>{
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');const pathname=u.pathname.replace(/^\/site(?=\/|$)/,'');const file=path.join(root,pathname==='/'?'index.html':decodeURIComponent(pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],remote=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message)});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('data:'))remote.push(r.url())});
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/#/login');await page.locator('input').first().fill('demo');await page.locator('input[type="password"]').fill('Demo123456!');await page.locator('.login-form button').last().click();await page.waitForURL('**/#/index');await page.locator('.sidebar-container').waitFor();console.log('PASS login');
  const fixtures=require('../huizhi-admin/src/demo/fixtures.json'),routes=[];
  function walk(items,prefix=''){for(const r of items){const p=r.path.startsWith('/')?r.path:prefix+'/'+r.path;if(r.children)walk(r.children,p);else if(!r.hidden)routes.push(p)}}walk(fixtures['/system/menu/getRouters'].data);
  async function goto(route){await page.evaluate(async p=>{const v=document.querySelector('#app').__vue__;await v.$router.push(p)},route);await page.waitForTimeout(1400);const actual=await page.evaluate(()=>document.querySelector('#app').__vue__.$route.path);assert.equal(actual,route)}
  for(const route of routes){await goto(route);const text=(await page.locator('.app-main').innerText()).slice(0,65).replace(/\s+/g,' ');console.log(route,text);
   if(route==='/operate/station'){
    await page.getByText('新增',{exact:true}).first().click();
    await page.locator('.el-dialog:visible input').nth(0).fill('自动化演示站点');await page.locator('.el-dialog:visible input').nth(1).fill('演示路 1 号');await page.locator('.el-dialog:visible input').nth(2).fill('110101');
    await page.getByRole('button',{name:'确 定',exact:true}).click();await page.waitForTimeout(200);assert((await page.locator('.app-main').innerText()).includes('自动化演示站点'));
    const row=page.locator('.el-table__row').filter({hasText:'自动化演示站点'});await row.getByRole('button',{name:'修改'}).click();await page.locator('.el-dialog:visible input').nth(0).fill('自动化演示站点-已修改');await page.getByRole('button',{name:'确 定',exact:true}).click();await page.waitForTimeout(150);assert((await page.locator('.app-main').innerText()).includes('自动化演示站点-已修改'));
    const updated=page.locator('.el-table__row').filter({hasText:'自动化演示站点-已修改'});await updated.getByText('删除',{exact:true}).click();await page.getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(150);assert(!(await page.locator('.app-main').innerText()).includes('自动化演示站点-已修改'));console.log('PASS station CRUD');
   }
  }
  await goto('/operate/fault');await page.getByRole('heading',{name:'故障工单',exact:true}).waitFor();await page.locator('.el-table__row').first().getByRole('button',{name:'详情'}).click();await page.getByRole('button',{name:'分配处理人'}).click();
  const action=()=>page.locator('.el-dialog:visible').filter({has:page.locator('textarea[placeholder="填写处理步骤或解决结果"]')});await action().locator('.el-select').click();await page.locator('.el-select-dropdown:visible').getByText('演示管理员 (demo)').click();await action().locator('textarea').fill('安排演示管理员检查');await action().getByRole('button',{name:'确认',exact:true}).click();
  for(const [button,note]of [['开始处理','检查接口'],['提交解决结果','更换连接器后正常'],['确认关闭','复查通过']]){await page.getByRole('button',{name:button,exact:true}).click();await action().locator('textarea').fill(note);await action().getByRole('button',{name:'确认',exact:true}).click()}
  await page.waitForTimeout(200);assert((await page.locator('.el-descriptions').innerText()).includes('已关闭'));await page.screenshot({path:path.join(root,'original-demo-preview.png'),fullPage:true});console.log('PASS original fault lifecycle');console.log('PAGE_ERRORS',JSON.stringify([...new Set(errors)]));console.log('EXTERNAL_REQUESTS',JSON.stringify(remote));assert.equal(remote.length,0);assert.equal(errors.length,0)
  const prefixPage=await browser.newPage();await prefixPage.goto(base+'/site/#/login');await prefixPage.locator('input').first().fill('demo');await prefixPage.locator('input[type="password"]').fill('Demo123456!');await prefixPage.locator('.login-form button').last().click();await prefixPage.waitForURL('**/site/#/index');console.log('PASS subdirectory deployment login');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
