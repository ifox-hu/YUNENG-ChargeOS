export function periodComparison(current, previous, label = '较前一等长时段') {
  if (current == null || previous == null || !Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return { text: '暂无对比数据', direction: 'neutral' }
  const delta = Number(current) - Number(previous)
  if (!delta) return { text: label + '持平', direction: 'neutral' }
  if (!Number(previous)) return { text: label + '：对比基数为 0', direction: 'neutral' }
  return { text: label + ' ' + (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta / Number(previous) * 100).toFixed(1) + '%', direction: delta > 0 ? 'up' : 'down' }
}

export function businessMetrics(row) {
  const devices = Number(row.deviceCount)
  return { ...row, revenuePerDevice: devices > 0 && row.revenue != null ? Number(row.revenue) / devices : null, activeDeviceRate: devices > 0 && row.activeDeviceCount != null ? Number(row.activeDeviceCount) / devices * 100 : null }
}

export function durationText(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes)) || Number(minutes) < 0) return '时间未记录'
  const value = Math.floor(Number(minutes))
  if (value < 60) return value + ' 分钟'
  if (value < 1440) return Math.floor(value / 60) + ' 小时 ' + value % 60 + ' 分钟'
  return Math.floor(value / 1440) + ' 天 ' + Math.floor(value % 1440 / 60) + ' 小时'
}

export function ticketStatus(value) {
  return { NEW: '待分配', ASSIGNED: '已分配', PROCESSING: '处理中', RESOLVED: '待确认', CLOSED: '已关闭' }[value] || value || '状态未记录'
}
