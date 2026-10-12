const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const root=path.resolve(__dirname,'../site');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/site\//,'/');
    const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const demoUrl=process.env.DEMO_URL || 'http://127.0.0.1:'+server.address().port+'/site/#/login';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.context().addCookies([{name:'Admin-Token',value:'local-session-preserved',url:new URL(demoUrl).origin}]);
    await page.goto(demoUrl);
    await page.locator('input').first().fill('demo');
    await page.locator('input[type="password"]').fill('Demo123456!');
    await page.locator('.login-form button').last().click();
    await page.waitForURL('**/#/index');
    assert((await page.context().cookies()).some(c=>c.name==='Demo-Token'));
    assert.equal((await page.context().cookies()).find(c=>c.name==='Admin-Token').value,'local-session-preserved');
    await page.locator('.avatar-wrapper').click();
    await page.getByText('退出登录', { exact: true }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForURL('**/#/login');
    assert(!((await page.context().cookies()).some(c => c.name === 'Demo-Token')));
    assert.equal((await page.context().cookies()).find(c=>c.name==='Admin-Token').value,'local-session-preserved');
    await page.reload();
    await page.locator('.login-form').waitFor();
    console.log('PASS demo login/logout preserves local admin cookie; logout clears demo cookie and preserves deployment path');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
