import { recentPeriod, validatePeriod } from '../views/operations/period'
// Aggregate the existing browser fixtures. No generated revenue or fabricated map coordinates.
export function demoOverview(db, query, identity = { root: true, tenantId: 9999 }, now = new Date()) {
  const rows = key => { const c = db.lists[key] || {}; return c.rows || c.data || [] }
  const equal = (a, b) => String(a) === String(b)
  const requested = query.tenantId ? Number(query.tenantId) : null
  if (!identity.root && requested && !equal(requested, identity.tenantId)) throw new Error('无权查看其他运营商')
  const tenantId = identity.root ? requested : identity.tenantId
  const own = row => !tenantId || equal(row.tenantId, tenantId)
  const operators = rows('/system/tenant/list').filter(row => identity.root || equal(row.id, identity.tenantId)).map(row => ({ id: row.id, name: row.tenantName }))
  if (tenantId && !operators.some(row => equal(row.id, tenantId))) throw new Error('运营商不存在')
  const stationOptions = rows('/operator/station/list').filter(s => own(s) && !Number(s.delFlag))
  const stationId = query.stationId ? Number(query.stationId) : null
  if (stationId && !stationOptions.some(s => equal(s.stationId, stationId))) throw new Error('站点不存在或不属于当前运营商')
  const stations = stationOptions.filter(s => !stationId || equal(s.stationId, stationId))
  const piles = rows('/operator/pile/list').filter(p => own(p) && !Number(p.deleted) && (!stationId || equal(p.stationId, stationId)))
  const pileIds = new Set(piles.map(p => String(p.tenantId) + ':' + String(p.pileId)))
  const allPiles = rows('/operator/pile/list')
  const filtered = query.startDate != null || query.endDate != null
  const [startDate, endDate] = filtered ? validatePeriod(query.startDate, query.endDate) : recentPeriod(30)
  const scopedOrders = rows('/operator/order/list').filter(o => own(o) && (!stationId || pileIds.has(String(o.tenantId) + ':' + String(o.pileId))))
  const inPeriod = (o, start, end) => String(o.createTime).slice(0, 10) >= start && String(o.createTime).slice(0, 10) <= end
  const orders = scopedOrders.filter(o => !filtered || inPeriod(o, startDate, endDate))
  const sum = (list, get) => list.reduce((s, row) => s + (Number(get(row)) || 0), 0)
  const sales = o => ['3', '4', '5', '6', '7'].includes(String(o.orderState)) ? o.ordergold : 0
  const refund = o => String(o.orderState) === '4' ? o.refundAmount : 0
  const revenue = list => sum(list, sales) - sum(list, refund)
  const summary = { stationTotal: stations.length, totalNumbers: piles.length, onLine: piles.filter(p => Number(p.runningStatus) === 0).length, offLine: piles.filter(p => Number(p.runningStatus) === 1).length, sumSales: sum(orders, sales), reSales: sum(orders, refund), realSales: revenue(orders), chargeTimes: orders.length, consumePower: sum(orders, o => o.consumePower) }
  summary.unknownState = summary.totalNumbers - summary.onLine - summary.offLine
  const comparison = { available: filtered }
  if (filtered) {
    const length = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1
    const shift = days => new Date(Date.parse(startDate + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10)
    comparison.period = { startDate: shift(length), endDate: shift(1) }
    const previous = scopedOrders.filter(o => inPeriod(o, comparison.period.startDate, comparison.period.endDate))
    comparison.summary = { realSales: revenue(previous), chargeTimes: previous.length, consumePower: sum(previous, o => o.consumePower) }
  }
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const selected = orders.filter(o => Number(String(o.createTime).slice(11, 13)) === hour && String(o.createTime).length >= 13)
    return { hour, count: selected.length, power: sum(selected, o => o.consumePower) }
  })
  const stateNames = ['下单', '取消', '支付成功', '退款', '完成', '结算中', '手动结算']
  const states = stateNames.map((name, i) => ({ state: String(i + 1), name, count: orders.filter(o => String(o.orderState) === String(i + 1)).length }))
  states.push({ state: 'unknown', name: '其他/未识别', count: orders.filter(o => !states.some(s => s.state === String(o.orderState))).length })
  const orderQuality = { states, refundCount: states[3].count, refundAmount: summary.reSales, cancelledCount: states[1].count }
  const activeDevices = list => new Set(list.filter(o => pileIds.has(String(o.tenantId) + ':' + String(o.pileId))).map(o => String(o.tenantId) + ':' + String(o.pileId))).size
  const trend = Array.from({ length: (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1 }, (_, i) => {
    const day = new Date(Date.parse(startDate + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
    const selected = orders.filter(o => String(o.createTime).slice(0, 10) === day)
    return { day, revenue: revenue(selected), power: sum(selected, o => o.consumePower), count: selected.length }
  })
  const stationStats = stations.map(s => {
    const list = orders.filter(o => allPiles.some(p => equal(p.pileId, o.pileId) && equal(p.stationId, s.stationId) && equal(p.tenantId, o.tenantId)))
    return { stationId: s.stationId, tenantId: s.tenantId, name: s.stationName, deviceCount: piles.filter(p => equal(p.stationId, s.stationId) && equal(p.tenantId, s.tenantId)).length, activeDeviceCount: activeDevices(list), revenue: revenue(list), power: sum(list, o => o.consumePower), count: list.length }
  }).sort((a, b) => b.revenue - a.revenue || a.stationId - b.stationId)
  const ranking = stationStats.filter(s => s.count).slice(0, 8)
  const operatorStats = operators.filter(o => !tenantId || equal(o.id, tenantId)).map(o => {
    const list = orders.filter(order => equal(order.tenantId, o.id))
    return { tenantId: o.id, name: o.name, stationCount: stations.filter(s => equal(s.tenantId, o.id)).length, deviceCount: piles.filter(p => equal(p.tenantId, o.id)).length, activeDeviceCount: activeDevices(list), revenue: revenue(list), power: sum(list, order => order.consumePower), count: list.length }
  }).sort((a, b) => b.revenue - a.revenue)
  const visiblePile = row => { const p = allPiles.find(p => equal(p.pileId, row.pileId) && (row.tenantId == null || equal(p.tenantId, row.tenantId))); return p && own(p) && (!stationId || equal(p.stationId, stationId)) }
  const faults = (db.faults || []).filter(visiblePile)
  const events = (db.alarmEvents || db.deviceAlarmEvents || []).filter(visiblePile)
  const withStation = row => ({ ...row, stationName: (stationOptions.find(s => allPiles.some(p => equal(p.pileId, row.pileId) && equal(p.stationId, s.stationId) && equal(p.tenantId, s.tenantId))) || {}).stationName })
  const ageMinutes = value => {
    if (!value) return null
    const text = String(value).replace(' ', 'T'); const time = Date.parse(text.length === 10 ? text + 'T00:00:00+08:00' : /(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : text + '+08:00')
    return Number.isFinite(time) && time <= now.getTime() ? Math.floor((now.getTime() - time) / 60000) : null
  }
  const offline = piles.filter(p => String(p.runningStatus) === '1').map(p => ({ ...withStation(p), offlineMinutes: ageMinutes(p.offlineTime) })).sort((a, b) => (b.offlineMinutes == null ? -1 : a.offlineMinutes == null ? 1 : b.offlineMinutes - a.offlineMinutes))
  const actionSummary = { offline24Count: offline.filter(p => p.offlineMinutes != null && p.offlineMinutes >= 1440).length, offlineUnknownCount: offline.filter(p => p.offlineMinutes == null).length }
  const pendingFaults = faults.filter(t => t.status !== 'CLOSED').map(t => ({ ...withStation(t), ageMinutes: ageMinutes(t.createdAt) })).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).slice(0, 20)
  return { scope: { root: identity.root, tenantId, stationId }, operators, stationOptions, stations, summary, comparison, hourly, orderQuality, actionSummary, trend, ranking, stationStats, operatorStats, period: { startDate, endDate, filtered }, canFault: true, pendingFaults, offlineDevices: offline.slice(0, 20), faultSummary: { active: faults.filter(t => t.status !== 'CLOSED').length, closed: faults.filter(t => t.status === 'CLOSED').length, pending: faults.filter(t => t.status === 'NEW').length, resolved: faults.filter(t => t.status === 'RESOLVED').length }, alarms: events.slice(-6).reverse() }
}
