<template>
  <view class="container b-login">
    <navbar :title="registering ? '手机号注册' : '账号登录'"></navbar>
    <view class="panel">
      <view class="b-login-brand"><view class="b-login-mark"><van-icon name="flash" size="24px" /></view><text>驭能智充</text></view>
      <text class="title">{{ registering ? '创建你的账号' : '欢迎回来' }}</text>
      <text class="subtitle">{{ registering ? '注册后使用账号密码登录' : '登录后查看余额和充电订单' }}</text>
      <text class="label">账号</text>
      <input v-model="username" class="input" maxlength="32" placeholder="3至32位字母、数字或下划线" />
      <text class="label">密码</text>
      <input v-model="password" class="input" password maxlength="32" placeholder="8至32位，包含字母和数字" />
      <view v-if="registering">
        <text class="label">确认密码</text>
        <input v-model="confirmPassword" class="input" password maxlength="32" placeholder="请再次输入密码" />
        <text class="label">手机号</text>
        <input v-model="mobile" class="input" type="number" maxlength="11" placeholder="请输入手机号" />
        <text class="label">验证码</text>
        <view class="code-row">
          <input v-model="code" class="input code-input" type="number" maxlength="6" placeholder="6位验证码" />
          <button class="code-button" :disabled="busy || sending || countdown > 0" @click="sendCode">{{ sending ? '获取中' : countdown > 0 ? countdown + '秒后重试' : '获取验证码' }}</button>
        </view>
        <view v-if="testCode" class="notice">本地测试验证码：{{ testCode }}（5分钟有效）<text class="notice-detail">未发送短信，仅用于本地注册测试，不证明手机号归属。</text></view>
      </view>
      <button class="submit" :loading="busy" :disabled="busy || sending" @click="submit">{{ registering ? '注册账号' : '登录' }}</button>
      <text class="switch" @click="switchMode">{{ registering ? '已有账号？返回登录' : '没有账号？手机号注册' }}</text>
      <view v-if="!registering" class="hint">本地测试账号：demo<text class="notice-detail">密码：Demo123456!</text></view>
    </view>
  </view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import navbar from '../../components/navbar/index.vue'
const registering = ref(false)
const username = ref('demo')
const password = ref('')
const confirmPassword = ref('')
const mobile = ref('')
const code = ref('')
const testCode = ref('')
const busy = ref(false)
const sending = ref(false)
const countdown = ref(0)
let countdownTimer
const notify = title => uni.showToast({ title, icon: 'none' })
const call = (path, data) => new Promise((resolve, reject) => {
  uni.request({
    url: getApp().globalData.serverUrl.replace(/\/$/, '') + '/v1/auth/account/' + path,
    method: 'POST', timeout: 12000,
    header: { 'content-type': 'application/x-www-form-urlencoded' }, data,
    success: res => {
      if (res.data && res.data.code === 200) resolve(res.data.data)
      else reject(new Error((res.data && res.data.msg) || '请求失败，请重试'))
    },
    fail: err => reject(new Error((err.errMsg || '').includes('timeout') ? '请求超时，请检查后台连接' : '连接失败，请检查后台地址'))
  })
})
const switchMode = () => {
  if (busy.value || sending.value) return
  registering.value = !registering.value
  password.value = ''
  confirmPassword.value = ''
  if (registering.value && username.value === 'demo') username.value = ''
}
const sendCode = async () => {
  if (sending.value || busy.value || countdown.value) return
  if (!/^1[3-9]\d{9}$/.test(mobile.value)) { notify('请输入正确的手机号'); return }
  sending.value = true
  testCode.value = ''
  try {
    const data = await call('code', { mobile: mobile.value })
    if (data.localTest) testCode.value = data.testCode
    countdown.value = 60
    clearInterval(countdownTimer)
    countdownTimer = setInterval(() => { if (--countdown.value <= 0) clearInterval(countdownTimer) }, 1000)
  } catch (err) { notify(err.message) }
  finally { sending.value = false }
}
const finishLogin = data => {
  if (!data || !data.token || !data.member) throw new Error('登录响应不完整')
  uni.setStorageSync('token', data.token)
  uni.setStorageSync('user', data.member)
  if (data.member.mobile) uni.setStorageSync('phone', data.member.mobile)
  else uni.removeStorageSync('phone')
  const target = uni.getStorageSync('redirecturl') || '/pages/user/index'
  uni.removeStorageSync('redirecturl')
  uni.reLaunch({ url: target, fail: () => notify('登录成功，但页面跳转失败，请返回我的') })
}
const submit = async () => {
  if (busy.value || sending.value) return
  username.value = username.value.trim()
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username.value)) { notify('账号须为3至32位字母、数字或下划线'); return }
  if (!password.value) { notify('请输入密码'); return }
  if (registering.value) {
    if (!/^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7e]{8,32}$/.test(password.value)) { notify('密码须为8至32位并包含字母和数字'); return }
    if (password.value !== confirmPassword.value) { notify('两次输入的密码不一致'); return }
    if (!/^1[3-9]\d{9}$/.test(mobile.value) || !/^\d{6}$/.test(code.value)) { notify('请输入正确的手机号和6位验证码'); return }
  }
  busy.value = true
  try {
    if (registering.value) {
      await call('register', { username: username.value, password: password.value, mobile: mobile.value, code: code.value })
      registering.value = false
      password.value = ''
      confirmPassword.value = ''
      code.value = ''
      testCode.value = ''
      notify('注册成功，请输入密码登录')
    } else finishLogin(await call('login', { username: username.value, password: password.value }))
  } catch (err) { notify(err.message) }
  finally { busy.value = false }
}
onUnmounted(() => clearInterval(countdownTimer))
</script>

<style scoped>
.container { background: #f6f6f6; min-height: 100vh; padding-top: 180rpx; box-sizing: border-box; padding-bottom: 50rpx; }
.panel { margin: 30rpx; padding: 36rpx; background: white; border-radius: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: bold; color: #222; }
.subtitle { display: block; font-size: 26rpx; color: #888; margin: 16rpx 0 36rpx; }
.label { display: block; font-size: 28rpx; color: #444; margin-bottom: 12rpx; }
.input { background: #f5f6f8; border-radius: 12rpx; padding: 20rpx; height: 48rpx; font-size: 28rpx; margin-bottom: 24rpx; }
.submit { background: #4a6ef3; color: white; border-radius: 14rpx; margin-top: 32rpx; font-size: 30rpx; }
.submit[disabled] { background: #a4b4f3; color: white; }
.switch { display: block; text-align: center; color: #4a6ef3; margin: 30rpx 0; font-size: 28rpx; }
.code-row { display: flex; gap: 16rpx; align-items: flex-start; }
.code-input { flex: 1; width: 0; }
.code-button { width: 220rpx; height: 88rpx; line-height: 88rpx; font-size: 24rpx; color: #4a6ef3; padding: 0; }
.notice, .hint { background: #f1f4ff; border-radius: 12rpx; padding: 20rpx; color: #586178; font-size: 26rpx; }
.notice-detail { display: block; margin-top: 8rpx; font-size: 24rpx; }
</style>
