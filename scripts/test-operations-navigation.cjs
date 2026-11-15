const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const root = path.resolve(process.env.OPERATIONS_SITE_ROOT || path.join(__dirname, '../site'));

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(12000);
    if (process.env.LEGACY_THEME) await page.addInitScript(theme => localStorage.setItem('layout-setting', JSON.stringify({ theme })), process.env.LEGACY_THEME);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/#/login');
    await page.locator('.login-form input').first().fill('demo');
    await page.locator('.login-form input[type=password]').fill('Demo123456!');
    await fillDemoCaptcha(page);
    await page.locator('.login-form button').last().click();
    await page.waitForURL('**/#/index');
    await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('#app').__vue__.$store.state.settings.theme), '#2563eb', 'Restore the latest blue theme, including saved legacy themes');
    const group = page.locator('.sidebar-container .el-submenu').filter({ has: page.locator('.el-submenu__title', { hasText: '运营管理' }) }).first();
    for (const name of ['仪表盘', '经营统计', '桩分布', '数据大屏']) await group.getByRole('menuitem', { name, exact: true }).waitFor({ state: 'visible' });
    assert.equal(await group.locator('.el-menu-item').count(), 4);
    assert.equal(await group.locator('.el-menu-item.is-active').innerText(), '仪表盘');
    assert.equal(await group.locator('.el-menu-item.is-active').evaluate(element => getComputedStyle(element).color), 'rgb(37, 99, 235)');
    assert.equal(await group.locator('.el-menu-item.is-active').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(237, 244, 255)');
    await page.screenshot({ path: path.join(root, '../dashboard.png'), fullPage: true });
    console.log('PASS default dashboard and four-item operations group');
    await group.getByRole('menuitem', { name: '经营统计', exact: true }).click();
    await page.waitForURL('**/#/operations/statistics');
    await page.locator('.app-main .el-form').waitFor();
    assert.equal(await page.locator('.app-main .el-button--primary').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(37, 99, 235)');
    await page.goto(base + '/#/operate/total');
    await page.waitForURL('**/#/operations/statistics');
    console.log('PASS business statistics and legacy URL');
    await page.goto(base + '/#/operations/map');
    await page.getByRole('heading', { name: '桩分布', exact: true }).waitFor();
    await page.locator('[data-testid=station-map] canvas').waitFor();
    await page.getByPlaceholder('搜索站点名称或地址').fill('滨江');
    await page.locator('.station-item').first().click();
    await page.getByText('未录入有效坐标', { exact: true }).waitFor();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByPlaceholder('搜索站点名称或地址').fill('');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(root, '../station-map.png'), fullPage: true });
    await page.reload();
    await page.getByRole('heading', { name: '桩分布', exact: true }).waitFor();
    console.log('PASS station map and direct route reload');
    await page.locator('.sidebar-container').getByRole('menuitem', { name: '数据大屏', exact: true }).click();
    await page.waitForURL('**/#/operations/screen');
    await page.getByRole('heading', { name: '驭能智充运营数据中心', exact: true }).waitFor();
    assert.equal(await page.locator('.sidebar-container:visible').count(), 0);
    assert.equal(await page.locator('.navbar:visible').count(), 0);
    assert.equal(await page.locator('.tags-view-container:visible').count(), 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(root, '../screen.png'), fullPage: true });
    await page.getByRole('button', { name: '返回仪表盘', exact: true }).click();
    await page.waitForURL('**/#/index');
    await page.locator('.sidebar-container').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    console.log('PASS fullscreen screen, return navigation and no JavaScript errors');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
