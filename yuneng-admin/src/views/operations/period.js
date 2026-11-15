export function businessToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function recentPeriod(days) {
  const end = businessToday(); const start = new Date(end + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - days + 1)
  return [start.toISOString().slice(0, 10), end]
}
export function validatePeriod(start, end) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  if (!valid(start) || !valid(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 365) throw new Error('请选择有效日期范围，最多366天')
  return [start, end]
}
