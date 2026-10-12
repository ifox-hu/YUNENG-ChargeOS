export function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : '--'
}
