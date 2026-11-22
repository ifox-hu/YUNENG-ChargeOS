export const demoTenantRole = 'demo-tenant'
export const isDemoTenant = roles => process.env.VUE_APP_DEMO === 'true' && roles.includes(demoTenantRole)
const sessionKey = 'yuneng-demo-sessions-v1'
const lifetime = 7200
const accounts = {
  admin: { root: true, tenantId: 9999, password: 'admin123' },
  demo: { root: false, tenantId: 887001, password: 'Demo123456!' }
}

function readSessions() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey)) || {}
  } catch (_) {
    return {}
  }
}

function saveSession(sessions, token, username) {
  const now = Date.now()
  const active = Object.fromEntries(Object.entries(sessions).filter(([, session]) => session.expiresAt > now))
  if (username) active[token] = { username, expiresAt: now + lifetime * 1000 }
  else delete active[token]
  localStorage.setItem(sessionKey, JSON.stringify(active))
}

export function startDemoSession(username, password) {
  if (!Object.prototype.hasOwnProperty.call(accounts, username) || accounts[username].password !== password) return null
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')
  saveSession(readSessions(), token, username)
  return { access_token: token, expires_in: lifetime, tenant_id: accounts[username].tenantId }
}

export function getDemoSession(headers = {}) {
  const token = (headers.Authorization || headers.authorization || '').match(/^Bearer ([a-f0-9]{48})$/i)?.[1]
  if (!token) return null
  const session = readSessions()[token]
  if (!session || session.expiresAt <= Date.now() || !Object.prototype.hasOwnProperty.call(accounts, session.username)) return null
  const { root, tenantId } = accounts[session.username]
  return { token, username: session.username, root, tenantId }
}

export function updateDemoSession(identity, logout) {
  saveSession(readSessions(), identity.token, logout ? null : identity.username)
  return logout ? null : lifetime
}
