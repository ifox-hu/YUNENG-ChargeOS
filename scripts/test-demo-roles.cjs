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
  assert.equal(demoResult.data.tenant_id, 887001)
  const admin = adminResult.data.access_token
  const demo = demoResult.data.access_token
  assert.notEqual(admin, demo)
  assert.notEqual((await login('admin', 'wrong-password')).code, 200)
  const demoProfile = (await request('/system/user/getInfo', demo)).user
  assert.equal(demoProfile.userName, 'demo')
  assert.equal(demoProfile.tenantId, 887001)
  assert.equal((await request('/system/user/getInfo', admin)).user.userName, 'admin')
  assert.equal((await request('/system/menu/getRouters', demo)).data.some(r => r.path === '/system'), false)
  assert.equal((await request('/system/menu/getRouters', admin)).data.some(r => r.path === '/system'), true)
  assert.equal((await request('/system/tenant/list', demo)).code, 403)
  assert.equal((await request('/system/tenant/onboard', demo, 'post', {})).code, 403)
  assert.equal((await request('/operator/fault/alarms', demo, 'post', {})).code, 403)
  assert.equal((await request('/operator/station', demo, 'put', {})).code, 403)
  const overview = (await request('/operator/overview', demo)).data
  assert.equal(overview.scope.root, false)
  assert.equal(overview.scope.tenantId, 887001)
  assert.equal(overview.operators[0].name, '城际快充 · 演示')
  assert.equal(overview.stationOptions.length, 3)
  assert.equal((await request('/operator/overview', admin)).data.scope.root, true)
  const stationId = overview.stationOptions[0].stationId
  const stationDevices = '/operator/station/' + stationId + '/devices'
  const devices = await request(stationDevices, demo)
  assert.equal(devices.code, 200)
  assert.equal(devices.data.station.stationId, stationId)
  assert.equal(devices.data.piles.length, 12)
  assert.equal(devices.data.piles.flatMap(pile => pile.ports).length, 24)
  assert(devices.data.piles.every(pile =>
    pile.tenantId === 887001 && pile.ports.every(port => port.pileId === pile.pileId && port.tenantId === 887001)))
  assert.equal((await request(stationDevices, demo, 'put', {})).code, 403)
  assert.equal((await request(stationDevices + '?tenantId=9999', demo)).code, 403)
  const allStations = (await request('/operator/station/list?pageSize=50', admin)).rows
  const otherStation = allStations.find(row => Number(row.tenantId) === 9999)
  const otherDevices = '/operator/station/' + otherStation.stationId + '/devices'
  assert.equal((await request(otherDevices, admin)).code, 200)
  assert.equal((await request(otherDevices, demo)).code, 404)

  const rates = (await request(otherDevices + '/rates', admin)).data
  assert.ok(rates.length)
  const newPile = {
    pileId: 'SIM-QA-001', name: '验收双枪桩', wxRuleId: rates[0].id, pileType: 1,
    voltage: '750', electricity: '200', maxPower: 120, gunCount: 2
  }
  assert.equal((await request(otherDevices, demo, 'post', newPile)).code, 403)
  assert.notEqual((await request(otherDevices, admin, 'post', { ...newPile, wxRuleId: -1 })).code, 200)
  assert.notEqual((await request(otherDevices, admin, 'post', { ...newPile, gunCount: 0 })).code, 200)
  assert.equal((await request(otherDevices, admin, 'post', newPile)).code, 200)
  assert.notEqual((await request(otherDevices, admin, 'post', newPile)).code, 200)
  const snapshot = async () => (await request(otherDevices, admin)).data.piles.find(pile => pile.pileId === newPile.pileId)
  assert.equal((await snapshot()).runningStatus, 1)
  assert.deepEqual(Array.from((await snapshot()).ports, port => port.deviceId), ['1', '2'])
  assert.equal((await snapshot()).wxRuleId, newPile.wxRuleId)
  const simulator = '/simulator/evcs/sim/v1/station-device/start'
  assert.equal((await request(simulator, demo, 'post', { pileId: newPile.pileId })).code, 403)
  assert.equal((await request(simulator, admin, 'post', { pileId: newPile.pileId })).code, 200)
  assert.equal((await snapshot()).runningStatus, 0)
  assert.ok((await snapshot()).lastHeartbeat)

  const pileId = devices.data.piles[0].pileId
  const filter = '?tenantId=887001&stationId=' + stationId + '&pileId=' + pileId
  const alarm = (await request('/operator/fault/alarms' + filter, demo)).data.records[0]
  assert.equal(alarm.pileId, pileId)
  assert.equal((await request('/operator/fault/' + alarm.ticketId, demo)).data.ticket.pileId, pileId)
  assert.equal((await request('/operator/fault/stats' + filter, demo)).data.total, 1)
  const otherPileFilter = '?pileId=' + devices.data.piles[1].pileId
  assert.equal((await request('/operator/fault/alarms' + otherPileFilter, demo)).data.total, 0)
  assert.equal((await request('/operator/fault/stats' + otherPileFilter, demo)).data.total, 0)
  for (const [endpoint, key] of [
    ['/operator/station/list', 'stationId'],
    ['/operator/order/list', 'orderId'],
    ['/operator/fault/alarms', 'id'],
    ['/operator/fault/list', 'id']
  ]) {
    const all = await request(endpoint + '?pageSize=50', admin)
    const own = await request(endpoint + '?pageSize=50', demo, 'get', undefined, { 'tenant-id': '9999' })
    assert.equal(own.code, 200, endpoint)
    const allRows = all.rows || all.data.records
    const ownRows = own.rows || own.data.records
    assert(ownRows.length > 0 && ownRows.every(row => Number(row.tenantId) === 887001), endpoint)
    const foreign = allRows.find(row => Number(row.tenantId) === 9999)
    assert.ok(foreign, endpoint)
    const detail = endpoint.endsWith('/list') ? endpoint.slice(0, -5) : endpoint
    assert.equal((await request(detail + '/' + ownRows[0][key], demo)).code, 200, endpoint)
    assert.equal((await request(detail + '/' + foreign[key], admin)).code, 200, endpoint)
    assert.equal((await request(detail + '/' + foreign[key], demo)).code, 404, endpoint)
    if (key === 'orderId') {
      assert.equal((await request(detail + '/getOrderByOrderNumber/' + foreign.orderNumber, demo)).code, 404)
    }
    assert.equal((await request(endpoint + '?tenantId=9999', demo)).code, 403, endpoint)
  }
  assert.equal((await request('/auth/logout', demo, 'delete')).code, 200)
  assert.equal((await request('/operator/station/list', demo)).code, 401)
  assert.equal((await request('/operator/station/list', admin)).code, 200)

  const saved = JSON.parse(storage.get('yuneng-original-ui-demo-v1'))
  const { sampleMarker, prepareDashboardSamples } = files.get(path.join(source, 'dashboardSamples.js')).namespace
  const ports = saved.lists['/operator/port/list']
  const originalPorts = (ports.rows || ports.data).filter(port => port.createBy !== sampleMarker)
  ports.rows = ports.data = originalPorts.slice()
  saved.dashboardSampleVersion = 1
  prepareDashboardSamples(saved, saved.dashboardSampleDate, 43200)
  prepareDashboardSamples(saved, saved.dashboardSampleDate, 43200)
  assert.deepEqual(Array.from(ports.rows.filter(port => port.createBy !== sampleMarker)), originalPorts)
  assert.equal(ports.rows.filter(port => port.tenantId === 887001).length, 72)
})
