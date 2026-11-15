const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const { fillDemoCaptcha } = require('./demo-captcha-helper.cjs')

;(async () => {
  const root = path.resolve(__dirname, '../site')
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname.replace(/^\/site(?=\/|$)/, '')
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end() }
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'text/html')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = process.env.ENERGY_URL || 'http://127.0.0.1:' + server.address().port + '/site/#/login'
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    // r160 installs render on each renderer instance, rather than its prototype.
    function observeRenderer() {
      const Original = THREE.WebGLRenderer
      THREE.WebGLRenderer = function (...args) {
        const renderer = new Original(...args)
        const render = renderer.render
        renderer.render = function (scene, camera) {
          const record = window.energyGatheringProof
          if (!record || !record.start || record.end) return render.call(this, scene, camera)
          let coreScale = 1, dustScale = 1, gather = 0, energyCore = false
          scene.traverse(object => {
            const uniforms = object.material && object.material.uniforms
            if (uniforms && uniforms.uColor) { energyCore = true; coreScale = object.scale.x; gather = uniforms.uGather ? uniforms.uGather.value : 0 }
            if (uniforms && uniforms.uScale) dustScale = object.scale.x
          })
          const result = render.call(this, scene, camera)
          if (energyCore) {
            record.frames.push({ at: performance.now(), coreScale, dustScale, gather, route: location.hash })
            if (gather > 0.65 && !record.image) record.image = this.domElement.toDataURL('image/png')
          }
          return result
        }
        return renderer
      }
      THREE.WebGLRenderer.prototype = Original.prototype
    }
    await page.route('**/vendor/three-r160.min.js', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + '\n;(' + observeRenderer.toString() + ')();' })
    })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()) })
    async function openLogin(target) {
      await target.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await target.locator('.ec-ready canvas').waitFor({ timeout: 60000 })
      await target.getByPlaceholder('请输入账号').fill('demo')
      await target.getByPlaceholder('请输入密码').fill('Demo123456!')
      await fillDemoCaptcha(target)
    }
    await openLogin(page)
    const captcha = await page.locator('.login-code-img').getAttribute('src')
    await page.getByPlaceholder('请输入右侧验证码').fill('0000')
    await page.locator('.login-actions button').click()
    await page.locator('.el-message--error').waitFor()
    assert(page.url().includes('#/login'), 'failed authentication must remain on login')
    assert.equal(await page.locator('.ec-stage').getAttribute('data-transition'), null, 'failed authentication must not trigger gathering')
    await page.waitForFunction(previous => document.querySelector('.login-code-img').src !== previous, captcha)
    await page.locator('.el-message--error').waitFor({ state: 'hidden' })
    await fillDemoCaptcha(page)
    await page.evaluate(() => {
      const record = window.energyGatheringProof = { frames: [] }
      const component = document.querySelector('.ec-stage').__vue__
      const complete = component.energyScene.complete
      component.energyScene.complete = function () {
        record.start = performance.now()
        return complete().then(() => { record.end = performance.now() })
      }
    })
    await page.locator('.login-actions button').click()
    await page.waitForFunction(() => window.energyGatheringProof.end || window.energyGatheringProof.frames.some(frame => frame.gather > 0.45))
    const out = path.resolve(__dirname, '../outputs')
    fs.mkdirSync(out, { recursive: true })
    if (!await page.evaluate(() => window.energyGatheringProof.end)) await page.screenshot({ path: path.join(out, 'login-energy-gathering-page.png') })
    await page.waitForURL('**/#/index', { timeout: 15000 })
    const proof = await page.evaluate(() => window.energyGatheringProof)
    if (proof.image) fs.writeFileSync(path.join(out, 'login-energy-gathering.png'), Buffer.from(proof.image.split(',')[1], 'base64'))
    delete proof.image
    fs.writeFileSync(path.join(out, 'login-energy-gathering-proof.json'), JSON.stringify(proof, null, 2))
    console.log('GATHER ' + JSON.stringify({ ms: Math.round(proof.end - proof.start), frames: proof.frames.length, minDust: Math.min(...proof.frames.map(f => f.dustScale)), maxCore: Math.max(...proof.frames.map(f => f.coreScale)), maxGather: Math.max(...proof.frames.map(f => f.gather)) }))
    assert(proof.end - proof.start >= 800, 'success must show a visible gathering before navigation, observed ' + Math.round(proof.end - proof.start) + 'ms')
    assert(proof.end - proof.start < 2300, 'login must not hang on the visual transition')
    const converged = proof.frames.filter(frame => frame.dustScale < 0.65 && frame.coreScale > 1.05)
    assert(converged.length >= 3, 'render multiple actual frames with particles moving inward and the core intensifying')
    assert(proof.frames.every(frame => frame.route.startsWith('#/login')), 'gathering must finish while the login page remains mounted')
    assert(proof.frames.filter(frame => frame.gather >= 0.99).length >= 2, 'present the completed effect before unmounting')
    assert.equal(await page.locator('.ec-scene-tools').count(), 0)

    const reduced = await browser.newPage({ reducedMotion: 'reduce' })
    await openLogin(reduced)
    const fast = await reduced.locator('.ec-stage').evaluate(async el => {
      const start = performance.now()
      await el.__vue__.complete()
      return performance.now() - start
    })
    assert(fast < 150, 'reduced motion skips the animation delay')
    await reduced.close()
    assert.deepEqual(errors, [])
    console.log('PASS authenticated login: ' + Math.round(proof.end - proof.start) + 'ms visible inward gathering, ' + converged.length + ' contracted render frames, final effect presented before routing; reduced motion skips delay; no scene buttons or shader/page errors')
  } finally {
    if (browser) await browser.close()
    server.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
