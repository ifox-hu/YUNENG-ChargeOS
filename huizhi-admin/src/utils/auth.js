import Cookies from 'js-cookie'

const prefix = process.env.VUE_APP_DEMO === 'true' ? 'Demo-' : 'Admin-'
const TokenKey = prefix + 'Token'

const ExpiresInKey = prefix + 'Expires-In'

const TenantKey = prefix + 'Tenant'

export function getTenant() {
  return Cookies.get(TenantKey)
}

export function setTenant(tenantid) {
  return Cookies.set(TenantKey, tenantid)
}

export function removeTenant() {
  return Cookies.remove(TenantKey)
}
export function getToken() {
  const token = Cookies.get(TokenKey)
  // Format check only; signature and session validity remain server responsibilities.
  if (token && process.env.VUE_APP_DEMO !== 'true' && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    removeToken()
    removeTenant()
    removeExpiresIn()
    return undefined
  }
  return token
}

export function setToken(token) {
  return Cookies.set(TokenKey, token)
}

export function removeToken() {
  return Cookies.remove(TokenKey)
}

export function getExpiresIn() {
  return Cookies.get(ExpiresInKey) || -1
}

export function setExpiresIn(time) {
  return Cookies.set(ExpiresInKey, time)
}

export function removeExpiresIn() {
  return Cookies.remove(ExpiresInKey)
}
