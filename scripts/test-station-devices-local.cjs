// Run against the local Docker stack. Fixtures are isolated and cleaned up.
process.env.ALARM_BASE_URL ||= 'http://127.0.0.1:38080/'
const assert = require('node:assert/strict')
const { randomInt, randomBytes } = require('node:crypto')
const { sql, literal, request, login, until } = require('./lib/device-alarm-testkit.cjs')

const suffix = randomBytes(6).toString('hex')
const code = 'STN-QA-' + suffix
const pileId = 'SIM-QA-' + suffix
const rollbackPile = pileId + '-rollback'
const trigger = 'qa_port_' + suffix
const tenant = 780000000 + randomInt(1000000)
const account = 'qastn_' + suffix
const password = randomBytes(8).toString('hex') + 'Aa1!'
const simulate = 'simulator/evcs/sim/v1/station-device/'

async function ok(route, token, method, payload) {
  const response = await request(route, token, method, payload)
  assert.equal(response.code, 200, JSON.stringify({ route, message: response.msg }))
  return response.data
}

async function deny(route, token, method, payload) {
  assert.notEqual((await request(route, token, method, payload)).code, 200, route)
}

async function main() {
  assert.equal(sql(`SELECT COUNT(*) FROM sys_tenant WHERE id=${tenant}`), '0')
  assert.equal(sql(`SELECT COUNT(*) FROM sys_tenant_package WHERE id=${tenant}`), '0')
  const root = await login()
  let operator
  let started = false
  const pileIds = [pileId, rollbackPile].map(literal).join(',')
  const stations = [code, code + '-foreign'].map(literal).join(',')
  try {
    const menus = sql("SELECT GROUP_CONCAT(menu_id ORDER BY menu_id) FROM sys_menu WHERE parent_id=2066 OR perms LIKE 'operator:%' OR menu_id=2066")
    sql(`INSERT INTO sys_tenant_package(id,name,menu_ids,status,del_flag) VALUES(${tenant},${literal(code)},${literal(menus)},0,'0')`)
    await ok('system/tenant/onboard', root, 'POST', {
      tenant: { id: tenant, tenantName: code, userName: account, userPhone: '13800000000',
        userEmail: 'qa@example.invalid', tenantPackage: tenant, tenantTime: '2099-12-31', status: 0 },
      initialPassword: password
    })
    operator = await login(account, password)
    const station = { stationCode: code, stationName: code, address: 'Local validation',
      regionCode: '330100', lat: '30', lng: '120', deviceType: 4, delFlag: 0 }
    const own = await ok('operator/station', root, 'POST', station)
    const foreign = await ok('operator/station', operator, 'POST', { ...station, stationCode: code + '-foreign' })
    const devices = 'operator/station/' + own.stationId + '/devices'
    const foreignDevices = 'operator/station/' + foreign.stationId + '/devices'
    const rates = await ok(devices + '/rates', root)
    assert.ok(rates.length)
    const device = { pileId, name: code, wxRuleId: rates[0].id, pileType: 1,
      voltage: '750', electricity: '200', maxPower: 120, gunCount: 2 }
    await deny(devices, operator)
    await deny(devices, operator, 'POST', device)
    await deny(foreignDevices, operator, 'POST', device)
    await deny(devices, null, 'POST', device)
    assert.equal((await ok(foreignDevices, root)).canManage, false)
    await deny(devices, root, 'POST', { ...device, gunCount: 9 })
    assert.deepEqual((await ok(devices, root)).piles, [])
    assert.equal((await ok(devices, root, 'POST', device)).pileId, pileId)
    await deny(devices, root, 'POST', device)
    const snapshot = async () => (await ok(devices, root)).piles.find(pile => pile.pileId === pileId)
    let registered = await snapshot()
    assert.equal(registered.runningStatus, 1)
    assert.equal(registered.wxRuleId, device.wxRuleId)
    assert.deepEqual(registered.ports.map(port => port.deviceId), ['1', '2'])

    const existingPort = sql('SELECT MIN(port_id) FROM c_charging_port')
    sql(`CREATE TRIGGER ${trigger} BEFORE INSERT ON c_charging_port FOR EACH ROW
      SET NEW.port_id=IF(NEW.pile_id=${literal(rollbackPile)} AND NEW.device_id='2',${existingPort},NEW.port_id)`)
    await deny(devices, root, 'POST', { ...device, pileId: rollbackPile })
    assert.equal(sql(`SELECT COUNT(*) FROM c_charging_pile WHERE pile_id=${literal(rollbackPile)}`), '0')
    assert.equal(sql(`SELECT COUNT(*) FROM c_charging_port WHERE pile_id=${literal(rollbackPile)}`), '0')
    sql(`DROP TRIGGER ${trigger}`)

    await deny(simulate + 'start', operator, 'POST', { pileId })
    await ok(simulate + 'start', root, 'POST', { pileId })
    started = true
    registered = await until(async () => {
      const pile = await snapshot()
      return pile.runningStatus === 0 && pile.lastHeartbeat && pile
    }, 20000)
    assert.equal(registered.ports.length, 2)
    const alarm = await ok('operator/fault/simulate-alarm', root, 'POST', {
      pileId, faultType: 'OFFLINE', priority: 'NORMAL', description: code
    })
    const filter = '?stationId=' + own.stationId + '&pileId=' + pileId
    const tickets = await ok('operator/fault/list' + filter, root)
    assert.equal(tickets.records[0].id, alarm.ticket.id)
    await ok(simulate + 'stop', root, 'POST', { pileId })
    started = false
    assert.equal((await snapshot()).runningStatus, 1)
    console.log('PASS station creation, dual-gun registration, tariff and tenant checks, rollback, simulator heartbeat and fault ticket')
  } finally {
    if (started) await request(simulate + 'stop', root, 'POST', { pileId })
    if (operator) await request('auth/logout', operator, 'DELETE')
    sql(`DROP TRIGGER IF EXISTS ${trigger};
      DELETE FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id IN(${pileIds}));
      DELETE FROM c_device_alarm WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id IN(${pileIds}));
      DELETE FROM c_fault_ticket WHERE pile_id IN(${pileIds});
      DELETE FROM c_heartbeat WHERE pile_id IN(${pileIds});
      DELETE FROM c_charging_port WHERE pile_id IN(${pileIds});
      DELETE FROM c_charging_pile WHERE pile_id IN(${pileIds});
      DELETE FROM c_charging_station WHERE station_code IN(${stations});
      DELETE FROM c_operator_charge_rule WHERE tenant_id=${tenant};
      DELETE FROM sys_user_role WHERE user_id IN (SELECT user_id FROM sys_user WHERE tenant_id=${tenant});
      DELETE FROM sys_user_post WHERE user_id IN (SELECT user_id FROM sys_user WHERE tenant_id=${tenant});
      DELETE FROM sys_role_menu WHERE role_id IN (SELECT role_id FROM sys_role WHERE tenant_id=${tenant});
      DELETE FROM sys_role_dept WHERE role_id IN (SELECT role_id FROM sys_role WHERE tenant_id=${tenant});
      DELETE FROM sys_user WHERE tenant_id=${tenant};
      DELETE FROM sys_role WHERE tenant_id=${tenant};
      DELETE FROM sys_post WHERE tenant_id=${tenant};
      DELETE FROM sys_dept WHERE tenant_id=${tenant};
      DELETE FROM sys_tenant WHERE id=${tenant};
      DELETE FROM sys_tenant_package WHERE id=${tenant};`)
    await request('auth/logout', root, 'DELETE')
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
