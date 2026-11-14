// 真实后台只读页面与隔离浏览器中的 Pages 业务交互；不向真实会员发券或扣款。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs');
const output = path.resolve(__dirname, '../outputs/local-operations');
const ui = process.env.OPERATIONS_UI_URL || 'http://127.0.0.1:8080';
const demo = process.env.OPERATIONS_DEMO_URL || 'http://127.0.0.1:8010/site/';
const checks = [];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
async function adminToken() {
  const code = await (await fetch('http://127.0.0.1:38080/code', { signal: AbortSignal.timeout(30000) })).json();
  let answer = execFileSync('docker', ['exec', 'hcp-redis', 'redis-cli', '-n', '5', 'GET', 'captcha_codes:' + code.uuid], { encoding: 'utf8' }).trim();
  try { answer = JSON.parse(answer); } catch {}
  const result = await (await fetch('http://127.0.0.1:38080/auth/login', { signal: AbortSignal.timeout(30000), method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123', code: answer, uuid: code.uuid }) })).json();
  assert.equal(result.code, 200); return result.data.access_token;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    if (process.env.OPERATIONS_SKIP_LIVE !== 'true') {
    const live = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await live.addCookies([{ name: 'Admin-Token', value: await adminToken(), url: ui }, { name: 'Admin-Tenant', value: '9999', url: ui }]);
    const page = await live.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(ui + '/index');
    await page.getByText('当前日期范围暂无订单', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'live-overview.png'), fullPage: true });
    await page.getByRole('button', { name: /异常订单待核查/ }).click();
    await page.getByRole('radio', { name: '异常待核查', exact: true }).first().waitFor();
    assert(await page.getByRole('radio', { name: '异常待核查', exact: true }).last().isChecked());
    await page.getByRole('button', { name: '详情', exact: true }).first().click();
    await page.locator('.el-dialog:visible').getByText('订单号', { exact: true }).waitFor();
    pass('real dashboard, exception filter and order detail render with backend data');
    await page.goto(ui + '/index');
    const faultResponse = page.waitForResponse(response => response.url().includes('/operator/fault/list'));
    await page.getByRole('button', { name: /未关闭故障工单/ }).click();
    const faultUrl = new URL((await faultResponse).url());
    assert.equal(faultUrl.searchParams.get('status'), 'ACTIVE'); assert.equal(faultUrl.searchParams.get('targetTenantId'), '9999');
    await page.goto(ui + '/index');
    const pointsResponse = page.waitForResponse(response => response.url().includes('/operator/points/events?'));
    await page.getByRole('button', { name: /积分发放失败事件/ }).click();
    const pointsUrl = new URL((await pointsResponse).url());
    assert.equal(pointsUrl.searchParams.get('status'), 'DEAD'); assert.equal(pointsUrl.searchParams.get('targetTenantId'), '9999');
    await page.locator('.el-dialog:visible').getByText('积分事件与补偿', { exact: true }).waitFor();
    pass('real fault and points pending links apply ACTIVE/DEAD and tenant filters');
    await page.goto(ui + '/operations/finance');
    await page.getByRole('tab', { name: '本地对账', exact: true }).click();
    await page.getByRole('button', { name: '生成对账批次', exact: true }).waitFor();
    await page.goto(ui + '/operations/marketing');
    await page.getByRole('button', { name: /新建满减券/ }).waitFor();
    assert.deepEqual(errors, []);
    pass('real finance and marketing load without page errors; no live financial writes');
    await live.close();
    }
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const p = await context.newPage(), demoErrors = [], backend = [];
    p.on('pageerror', error => demoErrors.push(error.message));
    p.on('request', request => { if (/\/(prod-api|demo-api|dev-api)\//.test(request.url())) backend.push(request.url()); });
    await p.goto(demo + '#/login');
    await p.getByPlaceholder('请输入账号').fill('demo'); await p.getByPlaceholder('请输入密码').fill('Demo123456!');
    await fillDemoCaptcha(p); await p.getByRole('button', { name: '登 录' }).click(); await p.waitForURL('**/#/index');
    await p.getByText('浏览器模拟数据', { exact: true }).waitFor();
    await p.screenshot({ path: path.join(output, 'pages-overview.png'), fullPage: true });
    await p.goto(demo + '#/operations/orders');
    await p.getByPlaceholder('订单号 / 充电桩编号').fill('LOCAL_DEMO_0'); await p.getByRole('button', { name: /查询/ }).click();
    await p.getByRole('button', { name: '本地付款', exact: true }).click();
    await p.getByRole('button', { name: '确认付款', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.payments.length === 1);
    await p.goto(demo + '#/operations/finance'); await p.getByRole('button', { name: '记入分账', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.splits.length === 1);
    await p.goto(demo + '#/operations/orders');
    await p.getByPlaceholder('订单号 / 充电桩编号').fill('LOCAL_DEMO_0'); await p.getByRole('button', { name: /查询/ }).click();
    await p.getByRole('button', { name: '退款', exact: true }).click();
    let dialog = p.locator('.el-dialog:visible'); await dialog.locator('input').first().fill('5'); await dialog.locator('input').first().press('Tab');
    await dialog.locator('textarea').fill('页面验收部分退款'); await dialog.getByRole('button', { name: '确认退款', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.refunds.length === 1);
    await p.getByRole('button', { name: '退款', exact: true }).click(); dialog = p.locator('.el-dialog:visible');
    await dialog.locator('textarea').fill('页面验收剩余全退'); await dialog.getByRole('button', { name: '确认退款', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.refunds.length === 2);
    await p.goto(demo + '#/operations/finance'); await p.getByRole('tab', { name: '本地对账', exact: true }).click();
    await p.getByRole('button', { name: '生成对账批次', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.batches.length === 1);
    const state = await p.evaluate(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations);
    assert.equal(state.payments[0].paid_amount, 20); assert.equal(state.payments[0].refunded_amount, 20);
    assert.equal(state.splits.length, 3); assert.equal(state.batches[0].difference_count, 0);
    await p.getByRole('button', { name: '逐笔结果', exact: true }).click();
    await p.locator('.el-dialog:visible').getByText('一致', { exact: true }).waitFor();
    await p.locator('.el-message').last().waitFor({ state: 'hidden' });
    await p.waitForTimeout(400); // 等待弹窗过渡结束，确保验收截图可读。
    await p.screenshot({ path: path.join(output, 'pages-reconcile.png'), fullPage: true });
    pass('Pages UI payment, split, partial/full refund, reversal and zero-difference reconciliation');
    await p.goto(demo + '#/operations/marketing'); await p.getByRole('button', { name: /新建满减券/ }).click();
    dialog = p.locator('.el-dialog:visible');
    await dialog.locator('input').nth(0).fill('页面验收券');
    await dialog.locator('input').nth(4).fill('2020-01-01 00:00:00'); await dialog.locator('input').nth(4).press('Tab');
    await dialog.locator('input').nth(5).fill('2099-01-01 00:00:00'); await dialog.locator('input').nth(5).press('Tab');
    await dialog.getByRole('button', { name: '创建模板', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await p.getByRole('button', { name: '向会员发放', exact: true }).click();
    const member = await p.evaluate(() => { const list = JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).lists['/operator/member/list']; return (list.data || list.rows)[0].memberId; });
    await p.locator('.el-message-box input').fill(String(member)); await p.locator('.el-message-box').getByRole('button', { name: '确定', exact: true }).click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('yuneng-original-ui-demo-v1')).operations.coupons.length === 1);
    await p.getByPlaceholder('留空查看当前运营商').fill('12345'); await p.getByRole('button', { name: '切换运营商', exact: true }).click();
    await p.getByText('暂无数据', { exact: true }).first().waitFor();
    await p.setViewportSize({ width: 1366, height: 900 });
    await p.screenshot({ path: path.join(output, 'pages-empty-tenant.png'), fullPage: true });
    assert.deepEqual(demoErrors, []); assert.deepEqual(backend, []);
    pass('Pages coupon create/issue, tenant empty state, 1366px layout; no backend requests or page errors');
    fs.writeFileSync(path.join(output, process.env.OPERATIONS_SKIP_LIVE === 'true' ? 'ui-pages-result.json' : 'ui-result.json'), JSON.stringify({ checks, finishedAt: new Date().toISOString() }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
