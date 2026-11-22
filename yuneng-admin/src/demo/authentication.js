import { verifyDemoCaptcha } from './captcha'
import { startDemoSession } from './session'

export function createDemoSession({ username, password, code, uuid }) {
  const error = verifyDemoCaptcha(code, uuid)
  if (error) throw new Error(error)
  const session = startDemoSession(typeof username === 'string' && username.trim(), password)
  if (!session) throw new Error('演示账号或密码错误')
  return session
}
