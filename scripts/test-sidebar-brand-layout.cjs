const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const root = path.resolve(__dirname, '../site'), out = path.resolve(__dirname, '../outputs/sidebar-brand-layout');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site(?=\/|$)/, '');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'text/html');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.LAYOUT_URL || 'http://127.0.0.1:' + server.address().port + '/site/';
  const prefix = process.env.LAYOUT_PREFIX || (process.env.LAYOUT_URL ? 'online' : 'local');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [], errors = [];
  try {
    for (const config of [
      { name: 'desktop', width: 1440, height: 1000, scale: 1 },
      { name: 'zoom150', width: 1280, height: 720, scale: 1.5 },
      { name: 'mobile', width: 390, height: 844, scale: 1 }
    ]) {
      const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: config.scale });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '#/login', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('请输入账号').fill('demo'); await page.getByPlaceholder('请输入密码').fill('Demo123456!');
      await fillDemoCaptcha(page); await page.locator('.login-actions button').click(); await page.waitForURL('**/#/index');
      await page.locator('.metric-card').first().waitFor();
      async function setOpened(opened) {
        await page.evaluate(async opened => { const store = document.querySelector('#app').__vue__.$store; if (store.state.app.sidebar.opened !== opened) await store.dispatch('app/toggleSideBar'); }, opened);
        await page.waitForTimeout(650);
      }
      async function measure() {
        return page.locator('.sidebar-logo-container').evaluate(el => {
          const link = el.querySelector('.sidebar-logo-link'), img = link.querySelector('img'), title = link.querySelector('.sidebar-title');
          const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
          return { rail: rect(el.closest('.sidebar-container')), box: rect(el), link: rect(link), img: rect(img), title: title && rect(title), display: getComputedStyle(link).display };
        });
      }
      await setOpened(true);
      const expanded = await measure();
      await page.locator('.sidebar-logo-container').screenshot({ path: path.join(out, prefix + '-' + config.name + '-expanded.png') });
      assert.equal(expanded.display, 'flex', 'Generic sidebar anchor styles must not override brand flex layout');
      assert(Math.abs(expanded.img.width - 32) < .5);
      assert(Math.abs(expanded.title.x - expanded.img.x - expanded.img.width - 12) < .5, '12px gap');
      assert(Math.abs(expanded.img.x - expanded.box.x - 20) < .5, '20px left inset');
      assert(Math.abs(expanded.img.y + expanded.img.height / 2 - expanded.link.y - expanded.link.height / 2) < .5, 'icon vertically centered');
      assert(Math.abs(expanded.title.y + expanded.title.height / 2 - expanded.link.y - expanded.link.height / 2) < .5, 'wordmark vertically centered');
      assert(expanded.title.x + expanded.title.width <= expanded.box.x + expanded.box.width - 19);
      if (config.name !== 'mobile') {
        await setOpened(false);
        const collapsed = await measure();
        assert.equal(collapsed.title, null);
        assert(collapsed.box.x >= -.5 && Math.abs(collapsed.rail.width - 54) < .5, 'collapsed desktop brand stays visible in its 54px rail');
        assert(Math.abs(collapsed.img.x + collapsed.img.width / 2 - collapsed.box.x - collapsed.box.width / 2) < .5, 'collapsed icon horizontally centered');
        await page.locator('.sidebar-logo-container').screenshot({ path: path.join(out, prefix + '-' + config.name + '-collapsed.png') });
        results.push({ config: config.name, expanded, collapsed });
        await setOpened(true);
      } else results.push({ config: config.name, expanded });
      await page.screenshot({ path: path.join(out, prefix + '-' + config.name + '-page.png') });
      console.log('PASS ' + config.name + ' brand spacing, size, alignment and fold state');
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, prefix + '-result.json'), JSON.stringify({ base, results, errors, checkedAt: new Date().toISOString() }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
