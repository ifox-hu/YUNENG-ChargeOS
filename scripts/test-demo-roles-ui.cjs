const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

const root = path.resolve(process.env.DEMO_BUILD_ROOT || path.join(__dirname, '../site'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site\//, '/')
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], backend = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/\/(prod-api|demo-api)\//.test(request.url())) backend.push(request.url())
    })
    const origin = process.env.DEMO_URL || 'http://127.0.0.1:' + server.address().port + '/site/'
    const base = origin.replace(/\/?$/, '/') + '#'
    const sidebar = page.locator('.sidebar-container')
    const alarmPanel = page.getByTestId('alarm-events')
    async function login(username, password) {
      await page.getByPlaceholder('请输入账号').fill(username)
      await page.getByPlaceholder('请输入密码').fill(password)
      await fillDemoCaptcha(page)
      await page.locator('.login-actions button').click()
      await page.waitForURL('**/#/index')
      await page.locator('.update-time').waitFor()
    }

    await page.goto(base + '/login')
    assert.equal(await page.getByPlaceholder('请输入账号').inputValue(), 'admin')
    assert.equal(await page.getByPlaceholder('请输入密码').inputValue(), 'admin123')
    await login('admin', 'admin123')
    await page.getByText('admin · 全平台', { exact: false }).waitFor()
    await page.getByRole('button', { name: '运营商经营', exact: true }).waitFor()
    await page.goto(base + '/system/tenant')
    await page.locator('button').filter({ hasText: '运营商开户' }).waitFor({ timeout: 8000 }).catch(async error => {
      throw new Error(JSON.stringify({ url: page.url(), body: (await page.locator('body').innerText()).slice(0, 800), errors }), { cause: error })
    })
    await page.goto(base + '/operate/fault')
    await alarmPanel.getByText('DEMO-PLATFORM-CITY-OFFLINE', { exact: true }).waitFor()
    await alarmPanel.getByRole('button', { name: '新建异步告警' }).waitFor()

    await page.locator('.avatar-wrapper').click()
    await page.getByText('退出登录', { exact: true }).click()
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await page.waitForURL('**/#/login', { waitUntil: 'load' })
    await page.waitForFunction(() => !document.cookie.includes('Demo-Token='))

    await login('demo', 'Demo123456!')
    await page.getByText('demo · 本运营商', { exact: true }).waitFor()
    await page.getByTestId('overview-scope').getByText('城际快充 · 演示', { exact: true }).waitFor()
    const tenantCookie = (await page.context().cookies()).find(cookie => cookie.name === 'Demo-Tenant')
    assert.equal(tenantCookie.value, '887001')
    assert.equal(await page.locator('.shortcut-card').count(), 2)
    const businessLinks = await sidebar.locator('a[href*="#/operate/"]').evaluateAll(links =>
      links.map(link => link.hash).sort())
    assert.deepEqual(businessLinks, ['#/operate/fault', '#/operate/order', '#/operate/station'])
    assert.equal(await sidebar.locator('a[href*="#/system/"],a[href*="#/operations/"]').count(), 0)
    assert.equal(await page.getByRole('button', { name: '重置数据', exact: true }).count(), 0)
    for (const route of ['/system/tenant', '/operations/screen']) {
      await page.goto(base + route)
      await page.waitForURL('**/#/404')
    }

    await page.goto(base + '/operate/station')
    await page.getByText('【演示】城际·中心广场站', { exact: true }).first().waitFor()
    assert.equal(await page.getByRole('button', { name: '新增', exact: true }).count(), 0)
    assert.equal(await page.locator('.el-table__row').filter({ hasText: '滨江示范充电站' }).count(), 0)
    await page.goto(base + '/operate/order')
    await page.locator('.el-table__row').first().getByRole('button', { name: '详情' }).click()
    await page.waitForURL('**/#/operate/ordertDetail/?**')
    await page.goto(base + '/operate/fault')
    const cityAlarm = alarmPanel.locator('.el-table__row').filter({ hasText: 'DEMO-PLATFORM-CITY-OFFLINE' })
    await cityAlarm.waitFor()
    assert.equal(await alarmPanel.getByText('DEMO-ALARM-DEAD', { exact: true }).count(), 0)
    assert.equal(await alarmPanel.getByRole('button', { name: /新建异步告警|重放/ }).count(), 0)
    await page.locator('.fault-page > .el-table .el-table__row').filter({ hasText: 'DEMO_OV_CITY_' }).first().waitFor()
    await cityAlarm.getByRole('button', { name: '工单', exact: true }).click()
    const ticket = page.locator('.el-dialog:visible').filter({ hasText: '工单详情' })
    await ticket.waitFor()
    assert.equal(await ticket.getByRole('button', { name: '分配处理人' }).count(), 0)
    await page.context().addCookies([{ ...tenantCookie, value: '9999' }])
    await page.reload()
    await page.getByText('demo · 本运营商', { exact: true }).waitFor()
    assert.equal((await page.context().cookies()).find(cookie => cookie.name === 'Demo-Tenant').value, '887001')

    assert.deepEqual(errors, [])
    assert.deepEqual(backend, [])
    console.log('PASS platform onboarding, same-browser account switching, tenant-only navigation and read-only business views')
  } finally {
    if (browser) await browser.close()
    server.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
