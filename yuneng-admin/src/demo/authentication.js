import { verifyDemoCaptcha } from './captcha'

export function createDemoSession({ code, uuid }) {
  const error = verifyDemoCaptcha(code, uuid)
  if (error) throw new Error(error)
  return { access_token: 'DEMO_BROWSER_ONLY', expires_in: 7200, tenant_id: 9999 }
}
