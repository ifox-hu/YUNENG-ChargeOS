// Browser-only demonstration. Real authentication must verify challenges on a server.
const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const lifetime = 2 * 60 * 1000
let current = null

export function createDemoCaptcha(now = Date.now()) {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const code = Array.from(bytes.slice(0, 4), value => alphabet[value % alphabet.length]).join('')
  const uuid = Array.from(bytes.slice(4, 20), value => value.toString(16).padStart(2, '0')).join('')
  const letters = Array.from(code, (letter, i) => {
    const x = 16 + i * 25
    const y = 31 + bytes[20 + i] % 5
    const angle = bytes[20 + i] % 25 - 12
    return `<text x="${x}" y="${y}" transform="rotate(${angle} ${x} ${y})" fill="${i % 2 ? '#176b60' : '#284d62'}">${letter}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="116" height="46" viewBox="0 0 116 46"><rect width="116" height="46" rx="8" fill="#edf8f4"/><path d="M0 12Q30 35 62 14T116 28M0 36Q40 8 78 30T116 12" stroke="#9ad2c2" fill="none"/><g font-family="Verdana, sans-serif" font-size="25" font-weight="bold">${letters}</g></svg>`
  current = { code, uuid, expiresAt: now + lifetime }
  return { captchaEnabled: true, uuid, img: btoa(svg), imageType: 'image/svg+xml' }
}

export function verifyDemoCaptcha(code, uuid, now = Date.now()) {
  if (!current || !uuid || current.uuid !== uuid) return '验证码已失效，请刷新后重试'
  const challenge = current
  if (now >= challenge.expiresAt) {
    current = null
    return '验证码已过期，请刷新后重试'
  }
  const supplied = String(code || '').trim().toUpperCase()
  if (!supplied) return '请输入验证码'
  // Each submitted answer is single-use, including incorrect answers.
  current = null
  return supplied === challenge.code ? null : '验证码错误，请重新输入'
}
