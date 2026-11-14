// 首页专用、明确标记的展示样本；不请求接口，也不创建任何租户、订单或资金流水。
export const dashboardSamples = [
  { id: 'sample-city', name: '城际快充 · 城区示例', scene: '城区快充', stations: ['城际·中心广场站', '城际·滨江商务站', '城际·东城枢纽站'], devices: 36, dailyOrders: 42, priceCents: 3200, powerWh: 24500, pending: { exceptions: 5, faults: 3, points: 1 } },
  { id: 'sample-campus', name: '青禾充电 · 校园示例', scene: '校园慢充', stations: ['青禾·北校区站', '青禾·教师公寓站'], devices: 24, dailyOrders: 29, priceCents: 880, powerWh: 6500, pending: { exceptions: 2, faults: 1, points: 0 } },
  { id: 'sample-park', name: '云港能源 · 园区示例', scene: '园区运营', stations: ['云港·产业园站', '云港·物流园站', '云港·研发园站', '云港·园区公寓站'], devices: 48, dailyOrders: 18, priceCents: 4600, powerWh: 37000, pending: { exceptions: 3, faults: 2, points: 2 } }
]
function dateText(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
export function getDashboardSample(id, query = {}, now = new Date()) {
  const sample = dashboardSamples.find(row => row.id === id)
  if (!sample) throw new Error('未知示例运营商')
  const stations = sample.stations.map((name, index) => ({ station_id: id + '-station-' + index, station_name: name }))
  const selected = stations.filter(row => !query.stationId || row.station_id === query.stationId)
  const summary = { gross: 0, net: 0, power: 0, orders: 0, discount: 0, refunded: 0 }
  const days = {}, ranking = {}
  for (let day = 0; day < 30; day++) {
    const date = new Date(now); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - day)
    const dateKey = dateText(date)
    if ((query.from && dateKey < query.from) || (query.to && dateKey > query.to)) continue
    for (const station of selected) {
      const index = stations.indexOf(station)
      const orders = sample.dailyOrders + ((day * 7 + index * 11) % 19) - 5
      const gross = orders * (sample.priceCents + ((day + index) % 5) * 45)
      const discount = Math.floor(gross * .04), refunded = day % 6 === index % 6 ? Math.floor(gross * .015) : 0
      const net = gross - discount - refunded, power = orders * (sample.powerWh + index * 125)
      for (const key of ['gross', 'net', 'orders', 'discount', 'refunded']) summary[key] += ({ gross, net, orders, discount, refunded })[key]
      summary.power += power
      if (!days[dateKey]) days[dateKey] = { day: dateKey, orders: 0, power: 0, net: 0 }
      days[dateKey].orders += orders; days[dateKey].power += power; days[dateKey].net += net
      if (!ranking[station.station_id]) ranking[station.station_id] = { name: station.station_name, orders: 0, net: 0 }
      ranking[station.station_id].orders += orders; ranking[station.station_id].net += net
    }
  }
  for (const key of ['gross', 'net', 'discount', 'refunded']) summary[key] /= 100
  summary.power /= 1000
  const deviceCount = Math.round(sample.devices * selected.length / stations.length), offline = Math.floor(deviceCount / 9), unknown = Math.floor(deviceCount / 17)
  return {
    tenantId: id, sampleOnly: true, sampleName: sample.name, summary, stations,
    trend: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)).map(row => ({ ...row, net: row.net / 100, power: row.power / 1000 })),
    ranking: Object.values(ranking).sort((a, b) => b.net - a.net).map(row => ({ ...row, net: row.net / 100 })),
    devices: deviceCount ? [{ status: '0', count: deviceCount - offline - unknown }, { status: '1', count: offline }, { status: '2', count: unknown }] : [],
    pending: selected.length === stations.length ? { ...sample.pending } : { exceptions: Math.ceil(sample.pending.exceptions * selected.length / stations.length), faults: Math.ceil(sample.pending.faults * selected.length / stations.length), points: Math.ceil(sample.pending.points * selected.length / stations.length) },
    basis: '仅供界面体验的' + sample.scene + '样本，覆盖最近30天；结算、净收及待办均为示例，不计入实际业务，也不代表真实经营结果'
  }
}
