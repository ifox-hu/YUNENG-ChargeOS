const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin = 'http://127.0.0.1:8001';
async function main() {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const token of ['DEMO_BROWSER_ONLY','broken-token','eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0ZXN0In0.invalid']) {
      const response = await (await fetch(origin+'/prod-api/system/user/getInfo', {headers:{Authorization:'Bearer '+token}})).json();
      assert.equal(response.code,401,JSON.stringify(response));
      const context = await browser.newContext();
      await context.addCookies([{name:'Admin-Token',value:token,url:origin},{name:'Admin-Tenant',value:'9999',url:origin}]);
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/monitor/sys');
      await page.waitForURL('**/login?redirect=**');
      await page.locator('.login-form').waitFor();
      assert(!(await context.cookies()).some(c=>c.name==='Admin-Token'));
      assert.equal(errors.length,0,errors.join(';'));
      await page.reload(); await page.locator('.login-form').waitFor();
      await context.close();
    }
    console.log('PASS malformed/demo/tampered cookies redirect to login and clear session; gateway returns 401');
    const cap=await (await fetch(origin+'/prod-api/code')).json();
    let code=execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','GET','captcha_codes:'+cap.uuid],{encoding:'utf8'}).trim();
    try {code=JSON.parse(code)} catch {}
    const login=await (await fetch(origin+'/prod-api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123',uuid:cap.uuid,code})})).json();
    assert.equal(login.code,200);
    const context=await browser.newContext();
    await context.addCookies([{name:'Admin-Token',value:login.data.access_token,url:origin},{name:'Admin-Tenant',value:'9999',url:origin}]);
    const page=await context.newPage();
    await page.goto(origin+'/operate/order');
    await page.locator('.points-events > button').waitFor();
    // Deliberately fail remote logout; local logout must still finish.
    await page.route('**/prod-api/auth/logout',route=>route.fulfill({status:500,contentType:'application/json',body:'{"code":500,"msg":"test logout unavailable"}'}));
    await page.locator('.avatar-wrapper').click();
    await page.getByText('退出登录',{exact:true}).click();
    await page.getByRole('button',{name:'确定',exact:true}).click();
    await page.waitForURL('**/login**'); await page.locator('.login-form').waitFor();
    assert(!(await context.cookies()).some(c=>c.name==='Admin-Token'));
    await fetch(origin+'/prod-api/auth/logout',{method:'DELETE',headers:{Authorization:'Bearer '+login.data.access_token}});
    await context.close();
    console.log('PASS valid admin reaches order monitor; failed logout API still returns to login');
  } finally {await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
