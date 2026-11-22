const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');

(async () => {
  const root = path.resolve(__dirname, '../site');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site(?=\/|$)/, '');
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'text/html');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const base = process.env.DEMO_URL || 'http://127.0.0.1:' + server.address().port + '/site/';
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], backend = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/(prod-api|demo-api)\//.test(request.url())) backend.push(request.url()); });
    await page.goto(base + '#/login');
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    await fillDemoCaptcha(page);
    await page.locator('.login-actions button').click();
    await page.waitForURL('**/#/index');
    await page.goto(base + '#/operations/map');
    await page.waitForFunction(() => { const v = document.querySelector('.distribution-page')?.__vue__; return v && !v.loading && v.stations.length; });
    const count = await page.locator('.distribution-page').evaluate(el => ({ total: el.__vue__.scopedStations.length, missing: el.__vue__.missingCoordinates }));
    assert.deepEqual(count, { total: 24, missing: 0 }, 'all 24 bundled demo stations need usable, explicitly illustrative coordinates');
    await page.getByText('演示示意位置（非真实定位）', { exact: true }).first().waitFor();
    await page.waitForFunction(() => { const v = document.querySelector('.station-map-wrap')?.__vue__; return v?.chart?.getOption().series[1].data.length === 24; });
    await page.locator('.station-item').first().click();
    await page.locator('.el-dialog:visible').getByText('演示示意位置，非真实设备定位', { exact: true }).waitFor();
    await page.getByRole('button', { name: '关闭', exact: true }).click();

    // Reproduce an old same-day browser cache, preserving user edits and custom rows.
    await page.evaluate(() => {
      const key = 'yuneng-original-ui-demo-v1', db = JSON.parse(localStorage.getItem(key));
      const collection = db.lists['/operator/station/list'];
      const rows = collection.rows || collection.data;
      for (const row of rows) { row.lat = ''; row.lng = ''; delete row.coordinateSource; }
      rows.find(row => Number(row.stationId) === 69).lat = '114.1';
      rows.find(row => Number(row.stationId) === 69).lng = '22.6';
      rows.push({ stationId: 99555, tenantId: 9999, stationName: '用户自建无坐标站', address: '用户自己的地址', regionCode: '440300', lat: '', lng: '' });
      collection.data = rows; if (collection.rows) collection.rows = rows; collection.total = rows.length;
      delete db.demoStationLocationVersion;
      localStorage.setItem(key, JSON.stringify(db));
    });
    await page.reload();
    await page.waitForFunction(() => { const v = document.querySelector('.distribution-page')?.__vue__; return v && !v.loading && v.stations.length === 25; });
    const migrated = await page.locator('.distribution-page').evaluate(el => ({ missing: el.__vue__.missingCoordinates, manual: el.__vue__.stations.find(s => Number(s.stationId) === 69), custom: el.__vue__.stations.find(s => Number(s.stationId) === 99555) }));
    assert.equal(migrated.missing, 1, 'only the user-created station stays unlocated');
    assert.equal(migrated.manual.lat, '114.1');
    assert.equal(migrated.manual.lng, '22.6');
    assert.equal(migrated.manual.coordinateSource, undefined);
    assert.equal(migrated.custom.lat, '');
    await page.getByText(/1 个站点未录入有效坐标/).waitFor();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.distribution-page')?.__vue__?.missingCoordinates === 1);
    await page.evaluate(() => {
      const key = 'yuneng-original-ui-demo-v1', db = JSON.parse(localStorage.getItem(key));
      // Regeneration of the nine dashboard samples must retain illustrative points.
      db.dashboardSampleDate = '2000-01-01';
      // A user clearing a legacy fixture's coordinates after migration is respected.
      for (const rows of [db.lists['/operator/station/list'].rows, db.lists['/operator/station/list'].data]) {
        if (!rows) continue;
        const station = rows.find(row => Number(row.stationId) === 68);
        station.lat = ''; station.lng = ''; delete station.coordinateSource;
      }
      localStorage.setItem(key, JSON.stringify(db));
    });
    await page.reload();
    await page.waitForFunction(() => {
      const v = document.querySelector('.distribution-page')?.__vue__;
      return v && !v.loading && v.missingCoordinates === 2 && v.stations.filter(s => s.createBy === 'DEMO_OV_V1').every(s => s.coordinateSource === 'DEMO' && s.lat && s.lng);
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(backend, []);
    console.log('PASS 24 visible demo points, illustrative labels, same-day cache migration, preserved manual/custom data and later clears, daily regeneration, reload and no backend requests');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
