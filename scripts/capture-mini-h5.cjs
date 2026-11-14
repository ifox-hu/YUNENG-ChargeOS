// Capture the actual uni-app H5 build against the local backend, not mock pages.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main() {
  const base = process.env.MINI_H5_URL || 'http://127.0.0.1:8421/';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const captured = [], errors = [];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push(e.message));
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 39.9045, longitude: 116.4088 });
    await page.route('http://localhost:38080/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('http://localhost:38080', 'http://127.0.0.1:38080'), timeout: 30000 });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
    const output = path.resolve(__dirname, '../docs/screenshots/mini');
    fs.mkdirSync(output, { recursive: true });
    const capture = async (route, name) => {
      await page.goto(base + '#/' + route);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(output, name + '-h5.png'), fullPage: false });
      captured.push(name + '-h5.png');
      console.log(name, (await page.locator('body').innerText()).slice(0, 300));
    };
    await capture('pages/user/login', 'login');
    const login = await (await fetch('http://127.0.0.1:38080/hcp-mp/v1/auth/account/login', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=demo&password=Demo123456!'
    })).json();
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ type: 'object', data: user }));
    }, { token: login.data.token, user: login.data.member });
    const api = async (route, data, method = 'GET') => {
      const url = 'http://127.0.0.1:38080/hcp-mp/' + route;
      const response = await fetch(method === 'GET' ? url + '?' + new URLSearchParams(data) : url, {
        method, headers: { token: 'Bearer ' + login.data.token, 'content-type': 'application/json' },
        ...(method !== 'GET' ? { body: JSON.stringify(data) } : {})
      });
      const result = await response.json();
      if (result.code !== 200) throw new Error(route + ': ' + result.msg);
      return result.data;
    };
    await capture('pages/index/index', 'home');
    for (const [label, name] of [['价格最低', 'home-price'], ['智能排序', 'home-smart']]) {
      await page.getByText(label, { exact: true }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(output, name + '-h5.png'), fullPage: false });
      captured.push(name + '-h5.png');
    }
    const stations = await api('charging/getPlotInfoPage', {
      deviceType: 4, lat: 39.9045, lng: 116.4088, sortType: 1, distance: 100000000, pageNo: 1, pageSize: 5
    }, 'POST');
    if (!stations.records?.length) throw new Error('No existing station available');
    const station = stations.records[0];
    await capture('pages/station/index?' + new URLSearchParams({ plotId: station.stationId, deviceType: station.deviceType, distance: station.distance }), 'station');
    const detail = await api('charging/plotDetail', { plotId: station.stationId, deviceType: station.deviceType });
    const pile = [...(detail.fastPileList || []), ...(detail.slowPileList || [])][0];
    if (pile) await capture('pages/station/create?key=' + encodeURIComponent(pile.pileNo), 'charge-select');
    await capture('pages/user/order', 'orders');
    const orders = await api('order/queryOrderList', { userId: login.data.member.memberId, orderStatus: 3, pageNo: 1, pageSize: 5 });
    const order = orders.records?.[0];
    if (!order) throw new Error('No completed test order available');
    await capture('pages/user/orderdetail?orderNumber=' + encodeURIComponent(order.orderNumber), 'order-detail');
    for (const [route, name] of [
      ['pages/user/index', 'profile'], ['pages/wallet/balance', 'balance'],
      ['pages/wallet/points', 'points'], ['pages/repair/create', 'repair-create'],
      ['pages/repair/list', 'repair-list']
    ]) await capture(route, name);
    if (captured.length !== 13) throw new Error('Expected 13 screenshots, got ' + captured.length);
    if (errors.length) throw new Error('Page errors: ' + errors.join('; '));
    fs.writeFileSync(path.join(output, 'capture-manifest.json'), JSON.stringify({capturedAt:new Date().toISOString(), source:'current blue-white mini H5 build, local API read-only', viewport:{width:390,height:844},deviceScaleFactor:2,files:captured,errors},null,2));
    console.log('PASS 13 current mini screenshots; no page errors or business writes');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
