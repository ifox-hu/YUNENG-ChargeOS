// Capture the actual uni-app H5 build against the local backend, not mock pages.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route('http://localhost:38080/**', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
    const output = path.resolve(__dirname, '../docs/screenshots/mini');
    fs.mkdirSync(output, { recursive: true });
    const capture = async (route, name) => {
      await page.goto('http://127.0.0.1:8421/#/' + route);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(output, name + '-h5.png') });
      console.log(name, (await page.locator('body').innerText()).slice(0, 300));
    };
    await capture('pages/user/login', 'login');
    const login = await (await fetch('http://localhost:38080/hcp-mp/v1/auth/account/login', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=demo&password=Demo123456!'
    })).json();
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ type: 'object', data: user }));
    }, { token: login.data.token, user: login.data.member });
    for (const [route, name] of [
      ['pages/user/index', 'profile'], ['pages/wallet/balance', 'balance'],
      ['pages/wallet/points', 'points'], ['pages/repair/create', 'repair-create'],
      ['pages/repair/list', 'repair-list']
    ]) await capture(route, name);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
