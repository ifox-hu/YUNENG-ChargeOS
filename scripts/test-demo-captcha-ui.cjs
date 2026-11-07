const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { readDemoCaptcha } = require('./demo-captcha-helper.cjs');

(async () => {
  const root = path.resolve(__dirname, '../site');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/site(?=\/|$)/, '');
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end();
    }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.DEMO_URL || 'http://127.0.0.1:' + server.address().port + '/site/';
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(new URL(base).origin) && !r.url().startsWith('data:')) requests.push(r.url()); });
    await page.goto(base + '#/login');
    await readDemoCaptcha(page);
    await page.locator('input').first().fill('demo');
    await page.locator('input[type="password"]').fill('Demo123456!');
    const submit = page.locator('.login-actions button');
    const code = page.getByPlaceholder('请输入右侧验证码');
    await submit.click();
    await page.getByText('请输入验证码', { exact: true }).waitFor();
    assert.equal((await page.context().cookies()).some(c => c.name === 'Demo-Token'), false);
    console.log('PASS empty captcha blocks login');
    const before = await page.locator('.login-code-img').getAttribute('src');
    await code.fill('0000');
    await code.press('Enter');
    await page.getByText('验证码错误，请重新输入', { exact: true }).waitFor();
    await page.waitForFunction(old => document.querySelector('.login-code-img').src !== old, before);
    assert.equal(await code.inputValue(), '');
    assert(page.url().endsWith('#/login'));
    assert.equal((await page.context().cookies()).some(c => c.name === 'Demo-Token'), false);
    console.log('PASS wrong captcha blocks login and refresh clears input');
    const previous = await page.locator('.login-code-img').getAttribute('src');
    await page.getByRole('button', { name: '刷新验证码' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(old => document.querySelector('.login-code-img').src !== old, previous);
    await readDemoCaptcha(page);
    await page.locator('.el-message--error').waitFor({ state: 'hidden' });
    fs.mkdirSync(path.join(__dirname, '../outputs'), { recursive: true });
    await page.locator('.login').screenshot({ path: path.join(__dirname, '../outputs/pages-captcha-desktop.png') });
    await code.fill((await readDemoCaptcha(page)).toLowerCase());
    await code.press('Enter');
    await page.waitForURL('**/#/index');
    await page.locator('.sidebar-container').waitFor();
    console.log('PASS keyboard refresh and case-insensitive captcha login at subdirectory');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(base + '#/login');
    await readDemoCaptcha(mobile);
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await mobile.locator('.field__row').boundingBox();
    assert(bounds.width > 116 && bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await mobile.screenshot({ path: path.join(__dirname, '../outputs/pages-captcha-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS mobile layout; no external requests or page errors');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
