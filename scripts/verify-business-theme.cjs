const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const root = path.resolve(__dirname, '../site');
const output = path.resolve(__dirname, '../outputs/blue-white-pages');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/site(?=\/|$)/, '');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.BUSINESS_URL || 'http://127.0.0.1:' + server.address().port + '/site/';
  const prefix = process.env.BUSINESS_URL ? 'online-' : 'local-';
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  fs.mkdirSync(output, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addInitScript(() => { if (!localStorage.getItem('layout-setting')) localStorage.setItem('layout-setting', JSON.stringify({ theme: '#008773' })); });
    const page = await context.newPage();
    const errors = [], backendRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/(prod-api|demo-api|dev-api)\//.test(request.url())) backendRequests.push(request.url()); });
    await page.goto(base + '#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByPlaceholder('请输入账号').fill('demo');
    await page.getByPlaceholder('请输入密码').fill('Demo123456!');
    await fillDemoCaptcha(page);
    await page.locator('.login-actions button').click();
    await page.waitForURL('**/#/index');
    await page.locator('.metric-card').first().waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('#app').__vue__.$store.state.settings.theme), '#2563eb');
    const views = [
      ['/index', 'overview', '.metric-card'],
      ['/operate/station', 'station-list', '.el-table__row'],
      ['/operate/order', 'order-list', '.el-table__row'],
      ['/operate/chargeStation', 'device-list', '.port-card'],
      ['/operate/fault', 'fault-list', '.fault-page .metric'],
      ['/operations/orders', 'business-orders', '.el-table__row'],
      ['/operations/finance', 'finance', '.app-main .el-tabs'],
      ['/operations/marketing', 'marketing', '.app-main .el-table']
    ];
    for (const [route, name, selector] of views) {
      await page.evaluate(async p => { const router = document.querySelector('#app').__vue__.$router; if (router.currentRoute.path !== p) await router.push(p); }, route);
      await page.locator(selector).first().waitFor();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(output, prefix + name + '.png'), fullPage: true });
      if (route === '/operate/fault') {
        const button = page.locator('.headline .el-button--primary');
        assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(37, 99, 235)');
      }
      assert.equal(await page.locator('.tags-view-item.active').first().evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
      console.log('PASS ' + prefix + name);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(backendRequests, []);
    console.log('PASS blue theme migration, white active labels, 8 business views; no page errors/backend requests');
    fs.writeFileSync(path.join(output, prefix + 'result.json'), JSON.stringify({ base, views: views.length, errors, backendRequests, checkedAt: new Date().toISOString() }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
