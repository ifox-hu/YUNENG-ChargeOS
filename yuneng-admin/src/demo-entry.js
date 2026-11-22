import Vue from 'vue'
import Form from 'element-ui/lib/form'
import FormItem from 'element-ui/lib/form-item'
import Input from 'element-ui/lib/input'
import Button from 'element-ui/lib/button'
import Checkbox from 'element-ui/lib/checkbox'
import Message from 'element-ui/lib/message'
import 'element-ui/lib/theme-chalk/base.css'
import 'element-ui/lib/theme-chalk/form.css'
import 'element-ui/lib/theme-chalk/form-item.css'
import 'element-ui/lib/theme-chalk/input.css'
import 'element-ui/lib/theme-chalk/button.css'
import 'element-ui/lib/theme-chalk/checkbox.css'
import 'element-ui/lib/theme-chalk/message.css'

import Login from './views/login'
import SvgIcon from './components/SvgIcon'
import './assets/icons/svg/user.svg'
import './assets/icons/svg/password.svg'
import './assets/icons/svg/validCode.svg'
import { createDemoCaptcha } from './demo/captcha'
import { createDemoSession } from './demo/authentication'
import { getDemoSession, updateDemoSession } from './demo/session'
import { getToken, getTenant, setToken, setExpiresIn, setTenant, removeToken, removeExpiresIn, removeTenant } from './utils/auth'

const loadAdmin = () => import(/* webpackChunkName: 'admin' */ './main')
const requestedRoute = location.hash.slice(1)
const queryStart = requestedRoute.indexOf('?')
const requestedPath = queryStart === -1 ? requestedRoute : requestedRoute.slice(0, queryStart)
const query = requestedRoute.slice(requestedPath.length)
const isLogin = requestedPath === '/login'
const redirect = isLogin ? new URLSearchParams(query).get('redirect') : requestedRoute
const destination = redirect && /^\/(?!\/)/.test(redirect) ? redirect : '/'

function showLoadError() {
  const title = document.querySelector('#loader-wrapper .load_title')
  title.textContent = '后台加载失败，请刷新页面重试'
}

const token = getToken()
const identity = token && getDemoSession({ Authorization: 'Bearer ' + token })
if (token && !identity) {
  removeToken()
  removeExpiresIn()
  removeTenant()
}
if (identity && getTenant() !== String(identity.tenantId)) setTenant(identity.tenantId)

if (identity || requestedPath === '/register') {
  loadAdmin().then(({ mountAdmin }) => mountAdmin()).catch(showLoadError)
} else {
  ;[Form, FormItem, Input, Button, Checkbox].forEach(component => Vue.use(component))
  Vue.component('svg-icon', SvgIcon)

  if (!isLogin) {
    const suffix = destination === '/' ? '' : '?redirect=' + encodeURIComponent(destination)
    history.replaceState(history.state, '', '#/login' + suffix)
  }

  const services = {
    async getCode() {
      return createDemoCaptcha()
    },
    async signIn(form, completeScene) {
      const session = createDemoSession(form)
      await completeScene()
      setToken(session.access_token)
      setExpiresIn(session.expires_in)
      setTenant(session.tenant_id)
      let admin
      try {
        admin = await loadAdmin()
      } catch {
        const identity = getDemoSession({ Authorization: 'Bearer ' + session.access_token })
        if (identity) updateDemoSession(identity, true)
        removeToken()
        removeExpiresIn()
        removeTenant()
        throw new Error('后台加载失败，请重试')
      }
      history.replaceState(history.state, '', '#' + destination)
      const mount = document.createElement('div')
      mount.id = 'app'
      shell.$destroy()
      shell.$el.replaceWith(mount)
      admin.mountAdmin()
    },
    showError(error) {
      Message.error(error.message)
    }
  }

  const shell = new Vue({
    render: h => h(Login, { props: { services } })
  }).$mount('#app')
}
