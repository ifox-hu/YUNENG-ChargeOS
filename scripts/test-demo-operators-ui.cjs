// Verifies built static Pages UI; all data stays in an isolated browser context.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../site');
let browser, server;
(async () => { try {
  let base = process.env.DEMO_URL;
  if (!base) {
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site(?=\/|$)/, '');
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
      res.end(fs.readFileSync(file));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + server.address().port + '/site/';
  }
  base = base.replace(/\/?$/, '/');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [], backend = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/\/(prod-api|demo-api)\//.test(r.url())) backend.push(r.url()); });
  await page.goto(base + '#/login');
  await page.locator('input').first().fill('demo');
  await page.locator('input[type="password"]').fill('Demo123456!');
  await fillDemoCaptcha(page); await page.locator('.login-form button').last().click(); await page.waitForURL('**/#/index');
  await page.goto(base + '#/system/tenant');
  await page.locator('button').filter({ hasText: '运营商开户' }).click();
  const dialog = page.locator('.el-dialog:visible');
  const input = label => dialog.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: label }) }).locator('input').first();
  for (const [label, value] of [['租户编码', '10001'], ['租户名称', '同步验收运营商'], ['管理员账号', 'syncoperator'], ['初始密码', 'Sync123456!'], ['手机号码', '13800000001'], ['邮箱地址', 'sync@example.com']]) await input(label).fill(value);
  await input('租户套餐').click();
  await page.locator('.el-select-dropdown:visible').getByText('静态演示运营套餐').click();
  await input('租赁结束时间').fill('2099-12-31'); await input('租赁结束时间').press('Tab');
  await dialog.getByRole('button', { name: '确 定', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.locator('.el-table__row').filter({ hasText: '同步验收运营商' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1'))).includes('Sync123456!')), false);
  await page.goto(base + '#/operate/chargeRule');
  const hours = page.locator('.rule-form .el-input-number input'); await hours.fill('6'); await hours.press('Tab');
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operatorRules[9999].max_charging_hours === 6);
  await page.getByPlaceholder('输入本运营商会员ID').fill('1003'); await page.getByRole('button', { name: '添加会员', exact: true }).click();
  await page.locator('.member-table .el-table__row').filter({ hasText: '1003' }).waitFor();
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operatorRules[9999].members.length === 0);
  await page.getByPlaceholder('留空管理当前租户').fill('10001'); await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.rule-form')?.textContent.includes('10001'));
  assert.equal(await hours.inputValue(), '24');
  await page.reload(); await page.locator('.rule-form').waitFor(); assert.equal(await hours.inputValue(), '6');
  assert.deepEqual(errors, []); assert.deepEqual(backend, []);
  fs.mkdirSync(path.join(__dirname, '../outputs'), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, '../outputs/pages-operator-ui.png'), fullPage: true });
  console.log('PASS operator onboarding, password exclusion, rule save/reload, whitelist add/remove, target switching, subdirectory routing; no backend requests or page errors');
} finally { if (browser) await browser.close(); if (server) server.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
