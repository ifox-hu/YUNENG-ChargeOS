// 平台总览只合并后端已授权返回的单运营商报表，示例数据走独立数据源。
export async function loadOverviewOperators(fetchPage) {
  const operators = [], seen = new Set()
  for (let pageNum = 1; ; pageNum++) {
    const response = await fetchPage({ pageNum, pageSize: 100 })
    const data = response.data
    const records = Array.isArray(data) ? data : data && data.records || response.rows
    const total = Number(data && !Array.isArray(data) ? data.total : response.total)
    if (!Array.isArray(records) || !Number.isFinite(total)) throw new Error('运营商列表格式异常')
    for (const row of records) {
      const id = String(row.id == null ? row.tenantId : row.id)
      if (!/^[1-9]\d*$/.test(id) || seen.has(id)) throw new Error('运营商列表重复或编码无效，请刷新重试')
      seen.add(id); operators.push({ id, name: row.tenantName || row.companyName || '运营商 ' + id })
    }
    if (operators.length >= total) return operators
    if (!records.length) throw new Error('运营商列表不完整，请刷新重试')
  }
}

export function mergeOperatorOverviews(entries) {
  const summary = { gross: 0, net: 0, power: 0, orders: 0, discount: 0, refunded: 0 }
  const days = {}, devices = {}, pending = { exceptions: 0, faults: 0, points: 0 }, ranking = [], stations = []
  const moneyKeys = ['gross', 'net', 'discount', 'refunded']
  const cents = value => Math.round(Number(value || 0) * 100)
  const operators = entries.map(({ id, name, report }) => {
    for (const key of Object.keys(summary)) summary[key] += moneyKeys.includes(key) ? cents(report.summary[key]) : Number(report.summary[key] || 0)
    for (const key of Object.keys(pending)) pending[key] += Number(report.pending[key] || 0)
    report.trend.forEach(row => {
      if (!days[row.day]) days[row.day] = { day: row.day, orders: 0, power: 0, net: 0 }
      days[row.day].orders += Number(row.orders || 0); days[row.day].power += Number(row.power || 0); days[row.day].net += cents(row.net)
    })
    report.devices.forEach(row => { devices[row.status] = (devices[row.status] || 0) + Number(row.count) })
    report.stations.forEach(row => stations.push({ ...row, tenantId: id, operatorName: name }))
    report.ranking.forEach(row => ranking.push({ ...row, name: name + ' / ' + row.name, tenantId: id }))
    return { id, name, ...report.summary, stationCount: report.stations.length, deviceCount: report.devices.reduce((sum, row) => sum + Number(row.count), 0) }
  })
  moneyKeys.forEach(key => { summary[key] /= 100 })
  return {
    tenantId: null, allOperators: true, sampleOnly: entries.length > 0 && entries.every(row => row.report.sampleOnly),
    summary, operators, stations, pending,
    trend: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)).map(row => ({ ...row, net: row.net / 100 })),
    devices: Object.entries(devices).map(([status, count]) => ({ status, count })),
    ranking: ranking.sort((a, b) => Number(b.net) - Number(a.net) || Number(b.orders) - Number(a.orders)).slice(0, 8),
    basis: '所选日期内全部运营商汇总；设备及待办为当前状态'
  }
}
