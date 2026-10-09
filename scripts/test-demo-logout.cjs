const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:8010/site/#/login');
    await page.locator('input').first().fill('demo');
    await page.locator('input[type="password"]').fill('Demo123456!');
    await page.locator('.login-form button').last().click();
    await page.waitForURL('**/#/index');
    await page.locator('.avatar-wrapper').click();
    await page.getByText('退出登录', { exact: true }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForURL('**/#/login');
    assert(!((await page.context().cookies()).some(c => c.name === 'Admin-Token')));
    await page.reload();
    await page.locator('.login-form').waitFor();
    console.log('PASS logout preserves deployment path, clears token and shows login after reload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
