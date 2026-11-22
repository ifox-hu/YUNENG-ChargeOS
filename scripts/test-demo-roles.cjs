const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { webcrypto } = require('node:crypto')
const { test } = require('node:test')
const vm = require('node:vm')

test('platform and tenant logins return different routes and scope operator records', async () => {
  const source = path.resolve(__dirname, '../yuneng-admin/src/demo')
  const files = new Map()
  const storage = new Map()
  const context = vm.createContext({
    URL, URLSearchParams, console, crypto: webcrypto, sessionStorage: {
      getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
    },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    btoa: value => Buffer.from(value, 'binary').toString('base64')
  })
  async function load(file) {
    if (files.has(file)) return files.get(file)
    const code = fs.readFileSync(file, 'utf8')
    const mod = new vm.SourceTextModule(file.endsWith('.json') ? 'export default ' + code : code, { context, identifier: file })
    files.set(file, mod)
    await mod.link(specifier => {
      const name = path.resolve(path.dirname(file), specifier)
      return load(path.extname(name) ? name : name + '.js')
    })
    return mod
  }
  const adapter = await load(path.join(source, 'adapter.js'))
  await adapter.evaluate()
  const request = async (url, token, method = 'get', data, headers = {}) =>
    (await adapter.namespace.demoAdapter({ url, method, data, headers: { ...headers, Authorization: token && 'Bearer ' + token } })).data
  async function login(username, password) {
    const captcha = await request('/code')
    const image = Buffer.from(captcha.img, 'base64').toString('utf8')
    const code = [...image.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map(x => x[1]).join('')
    assert.ok(code)
    return request('/auth/login', null, 'post', { username, password, uuid: captcha.uuid, code })
  }
  const adminResult = await login('admin', 'admin123')
  const demoResult = await login('demo', 'Demo123456!')
  assert.equal(adminResult.code, 200)
  assert.equal(demoResult.code, 200)
  const admin = adminResult.data.access_token
  const demo = demoResult.data.access_token
  assert.notEqual(admin, demo)
  assert.notEqual((await login('admin', 'wrong-password')).code, 200)
  assert.equal((await request('/system/user/getInfo', demo)).user.userName, 'demo')
  assert.equal((await request('/system/user/getInfo', admin)).user.userName, 'admin')
  assert.equal((await request('/system/menu/getRouters', demo)).data.some(r => r.path === '/system'), false)
  assert.equal((await request('/system/menu/getRouters', admin)).data.some(r => r.path === '/system'), true)
  assert.equal((await request('/system/tenant/list', demo)).code, 403)
  assert.equal((await request('/system/tenant/onboard', demo, 'post', {})).code, 403)
  assert.equal((await request('/operator/fault/alarms', demo, 'post', {})).code, 403)
  assert.equal((await request('/operator/station', demo, 'put', {})).code, 403)
  assert.equal((await request('/operator/overview', demo)).data.scope.root, false)
  assert.equal((await request('/operator/overview', admin)).data.scope.root, true)
  for (const [endpoint, key] of [
    ['/operator/station/list', 'stationId'],
    ['/operator/order/list', 'orderId'],
    ['/operator/fault/alarms', 'id'],
    ['/operator/fault/list', 'id']
  ]) {
    const all = await request(endpoint + '?pageSize=50', admin)
    const own = await request(endpoint + '?pageSize=50', demo, 'get', undefined, { 'tenant-id': '887001' })
    assert.equal(own.code, 200, endpoint)
    const allRows = all.rows || all.data.records
    const ownRows = own.rows || own.data.records
    assert(ownRows.length > 0 && ownRows.every(row => Number(row.tenantId) === 9999), endpoint)
    const foreign = allRows.find(row => Number(row.tenantId) === 887001)
    assert.ok(foreign, endpoint)
    const detail = endpoint.endsWith('/list') ? endpoint.slice(0, -5) : endpoint
    assert.equal((await request(detail + '/' + ownRows[0][key], demo)).code, 200, endpoint)
    assert.equal((await request(detail + '/' + foreign[key], admin)).code, 200, endpoint)
    assert.equal((await request(detail + '/' + foreign[key], demo)).code, 404, endpoint)
    if (key === 'orderId') {
      assert.equal((await request(detail + '/getOrderByOrderNumber/' + foreign.orderNumber, demo)).code, 404)
    }
    assert.equal((await request(endpoint + '?tenantId=887001', demo)).code, 403, endpoint)
  }
  assert.equal((await request('/auth/logout', demo, 'delete')).code, 200)
  assert.equal((await request('/operator/station/list', demo)).code, 401)
  assert.equal((await request('/operator/station/list', admin)).code, 200)
})
