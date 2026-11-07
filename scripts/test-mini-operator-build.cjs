const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const mini = path.resolve(__dirname, '../yuneng-mini');
const root = path.join(mini, 'unpackage/dist/build/h5');
let browser, server;
(async () => { try {
  const wxml = fs.readFileSync(path.join(mini, 'unpackage/dist/dev/mp-weixin/pages/user/login.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(mini, 'unpackage/dist/dev/mp-weixin/pages/user/login.js'), 'utf8');
  assert(wxml.includes('运营商编码')); assert(js.includes('tenantCode'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(mini, 'unpackage/dist/dev/mp-weixin/project.config.json'), 'utf8')).miniprogramRoot, './');
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/#/pages/user/login');
  await page.getByText('没有账号？手机号注册', { exact: true }).click();
  const label = page.getByText('运营商编码', { exact: true }); await label.waitFor();
  const code = page.locator('uni-input').nth(2).locator('input'); await code.fill('9999');
  assert.equal(await code.inputValue(), '9999');
  await page.getByText('已有账号？返回登录', { exact: true }).click(); await label.waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  fs.mkdirSync(path.join(__dirname, '../outputs'), { recursive: true });
  await page.getByText('没有账号？手机号注册', { exact: true }).click();
  await page.screenshot({ path: path.join(__dirname, '../outputs/mini-operator-register-h5.png'), fullPage: true });
  console.log('PASS mp-weixin compiled operator field/payload and H5 registration toggle/input, no page errors; native WeChat runtime not exercised');
} finally { if (browser) await browser.close(); if (server) server.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
