// Explicit demonstration fixtures, adapted from the user's original GitHub Pages
// sample configuration and daily formulas (captured 2026-11-15). Not real revenue.
export const sampleMarker = 'DEMO_OV_V1'
const configs = [
  { id: 887001, key: 'CITY', name: '城际快充 · 演示', stations: ['城际·中心广场站', '城际·滨江商务站', '城际·东城枢纽站'], devices: 36, dailyOrders: 42, priceCents: 3200, powerWh: 24500, province: '江苏省', city: '南京市', regionCode: '320100' },
  { id: 887002, key: 'CAMPUS', name: '青禾充电 · 演示', stations: ['青禾·北校区站', '青禾·教师公寓站'], devices: 24, dailyOrders: 29, priceCents: 880, powerWh: 6500, province: '浙江省', city: '杭州市', regionCode: '330100' },
  { id: 887003, key: 'PARK', name: '云港能源 · 演示', stations: ['云港·产业园站', '云港·物流园站', '云港·研发园站', '云港·园区公寓站'], devices: 48, dailyOrders: 18, priceCents: 4600, powerWh: 37000, province: '广东省', city: '深圳市', regionCode: '440300' }
]
export function createDashboardSamples(today, secondsOfDay = 43200) {
  const operators = []; const stations = []; const piles = []; const ports = []; const orders = []
  const money = cents => (cents / 100).toFixed(2)
  const stamp = (day, seconds) => day + ' ' + [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
  for (const c of configs) {
    operators.push({ id: c.id, tenantName: c.name, status: '0', remark: sampleMarker })
    const perStation = c.devices / c.stations.length; const offline = Math.floor(c.devices / 9); const unknown = Math.floor(c.devices / 17)
    c.stations.forEach((name, index) => {
      const stationId = c.id * 100 + index + 1; const stationCode = 'DEMO_OV_' + c.key + '_' + (index + 1)
      stations.push({ stationId, stationCode, stationName: '【演示】' + name, tenantId: c.id, address: '演示站点，仅供功能展示', regionCode: c.regionCode, province: c.province, city: c.city, createBy: sampleMarker, delFlag: 0 })
      for (let i = 0; i < perStation; i++) {
        const position = index * perStation + i
        const pileId = stationCode + '_P' + String(i + 1).padStart(2, '0')
        const runningStatus = position < offline ? 1 : position < offline + unknown ? 2 : 0
        piles.push({ pileId, name: '【演示】' + name + ' ' + (i + 1), stationId, stationCode, tenantId: c.id, runningStatus, deleted: 0, createBy: sampleMarker, remark: sampleMarker })
        for (const [portIndex, portName] of ['A枪', 'B枪'].entries()) {
          const gunStatus = runningStatus === 0 ? (portIndex ? 0 : [1, 0, 5][position % 3]) : null
          ports.push({
            portId: pileId + '_' + (portIndex + 1), deviceId: String(portIndex + 1), name: portName,
            pileId, tenantId: c.id, runningStatus: runningStatus === 0 ? 2 : runningStatus === 1 ? 1 : null,
            gunStatus, faultReason: gunStatus === 5 ? '连接器异常（演示）' : '', createBy: sampleMarker
          })
        }
      }
      for (let age = 0; age < 30; age++) {
        const day = new Date(Date.parse(today + 'T00:00:00Z') - age * 86400000).toISOString().slice(0, 10)
        const count = c.dailyOrders + (age * 7 + index * 11) % 19 - 5
        const gross = count * (c.priceCents + (age + index) % 5 * 45); const discount = Math.floor(gross * 0.04); const refund = age % 6 === index % 6 ? Math.floor(gross * 0.015) : 0; const paid = gross - discount
        for (let i = 0; i < count; i++) {
          const orderId = stationCode + '_D' + day.replace(/-/g, '') + '_' + String(i + 1).padStart(3, '0')
          const cents = Math.floor(paid / count) + (i < paid % count ? 1 : 0); const refunded = i === 0 ? refund : 0
          const limit = age ? 22 * 3600 : Math.max(0, Math.min(22 * 3600, secondsOfDay - 1800)); const seconds = Math.floor(limit * (i + 1) / (count + 1))
          orders.push({ orderId, orderNumber: orderId, pileId: stationCode + '_P' + String(i % perStation + 1).padStart(2, '0'), tenantId: c.id, orderState: refunded ? '4' : '3', ordergold: money(cents), refundAmount: money(refunded), consumePower: ((c.powerWh + index * 125) / 1000).toFixed(3), createTime: stamp(day, seconds), createBy: sampleMarker })
        }
      }
    })
  }
  return { operators, stations, piles, ports, orders }
}
export function prepareDashboardSamples(db, today, secondsOfDay) {
  if (db.dashboardSampleDate === today && db.dashboardSampleVersion === 2) return
  const sample = createDashboardSamples(today, secondsOfDay)
  for (const [key, items] of [['/system/tenant/list', sample.operators], ['/operator/station/list', sample.stations], ['/operator/pile/list', sample.piles], ['/operator/port/list', sample.ports], ['/operator/order/list', sample.orders]]) {
    const collection = db.lists[key] || (db.lists[key] = { code: 200, data: [] })
    const original = collection.rows || collection.data || []
    const data = original.filter(row => row.createBy !== sampleMarker && row.remark !== sampleMarker).concat(items)
    collection.data = data; if (collection.rows) collection.rows = data; collection.total = data.length
  }
  db.dashboardSampleDate = today; db.dashboardSampleVersion = 2
}
