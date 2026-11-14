<template>
  <main class="login energy-login" aria-label="驭能智充智慧运营平台登录">
    <div class="ec-atmosphere" aria-hidden="true" />
    <header class="ec-nav">
      <div class="ec-brand">
        <span class="ec-mark"><img src="@/assets/logo/yuneng.svg" alt=""></span>
        <div><b>驭能智充</b><small>YUNENG INTELLIGENCE</small></div>
      </div>
      <div class="ec-nav-right"><span><b class="ec-dot" />智慧运营平台</span><span>简体中文</span></div>
    </header>
    <section class="ec-hero">
      <div class="ec-eyebrow">BEYOND ENERGY. INTO THE FUTURE.</div>
      <h1>能量无界<span>智联未来</span></h1>
      <p>让数据流动，让连接发生。<br>以智慧，驱动每一种可能。</p>
    </section>
    <span class="ec-ghost-word" aria-hidden="true">ENERGY</span>
    <energy-scene ref="energyScene" @status="energyStatus = $event" />
    <div class="ec-callout ec-callout-a"><small>ENERGY NEXUS</small><strong><b class="ec-dot" /><span class="ec-status" aria-live="polite">{{ energyStatus }}</span></strong></div>
    <div class="ec-callout ec-callout-b"><small>CONNECTED INTELLIGENCE</small><strong>连接 · 感知 · 进化</strong></div>
    <span class="ec-side-caption" aria-hidden="true">YUNENG / INFINITE POSSIBILITIES</span>
    <section class="ec-panel-shell" aria-labelledby="login-heading">
      <div class="ec-panel">
        <div class="ec-panel-top"><span>ACCESS YOUR WORKSPACE</span><i class="el-icon-full-screen" aria-hidden="true" /></div>
        <h2 id="login-heading">欢迎回来</h2>
        <p class="ec-sub">登录管理平台，连接无限可能</p>
        <el-form
          ref="loginForm"
          :model="loginForm"
          :rules="loginRules"
          class="login-form"
        >
          <el-form-item prop="username">
            <label class="field">账号</label>
            <el-input
              v-model="loginForm.username"
              type="text"
              auto-complete="off"
              placeholder="请输入账号"
            >
              <svg-icon
                slot="prefix"
                icon-class="user"
                class="el-input__icon field__icon"
              />
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <label class="field">密码</label>
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              auto-complete="off"
              placeholder="请输入密码"
              @keyup.enter.native="handleLogin"
            >
              <svg-icon
                slot="prefix"
                icon-class="password"
                class="el-input__icon field__icon"
              />
            </el-input>
          </el-form-item>

          <el-form-item v-if="captchaEnabled" prop="code">
            <label class="field">验证码</label>
            <div class="field__row">
              <el-input
                v-model="loginForm.code"
                auto-complete="off"
                placeholder="请输入右侧验证码"
                maxlength="4"
                @keyup.enter.native="handleLogin"
              >
                <svg-icon
                  slot="prefix"
                  icon-class="validCode"
                  class="el-input__icon field__icon"
                />
              </el-input>
              <button type="button" class="login-code" aria-label="刷新验证码" title="看不清？点击换一张" @click="getCode">
                <img :src="codeUrl" alt="登录验证码" class="login-code-img">
              </button>
            </div>
            <span class="login-code-hint">看不清？点击图片换一张</span>
          </el-form-item>

          <div class="login-options">
            <el-checkbox v-model="loginForm.rememberMe">记住密码</el-checkbox>
            <span class="login-options__hint">忘记密码请联系管理员</span>
          </div>

          <el-form-item class="login-actions">
            <el-button
              :loading="loading"
              size="medium"
              type="primary"
              @click.native.prevent="handleLogin"
            >
              <span v-if="!loading">开启智慧之旅 <i class="el-icon-top-right" aria-hidden="true" /></span>
              <span v-else>登 录 中...</span>
            </el-button>
            <div v-if="register" class="login-actions__extra">
              <router-link class="link-type" :to="'/register'">立即注册</router-link>
            </div>
          </el-form-item>
        </el-form>
        <div class="ec-secure"><i class="el-icon-lock" aria-hidden="true" />安全连接 · 智慧协同</div>
      </div>
    </section>
    <footer class="ec-footer">
      <span class="ec-footer-word">ENERGY · CONNECTION · INTELLIGENCE</span>
      <span class="ec-footer-note">© 2026 驭能智充<br>{{ isDemo ? '模拟运营演示 · 数据仅保存在当前浏览器' : '充电桩运营管理平台' }}</span>
    </footer>
  </main>
</template>

<script>
import { getCodeImg } from '@/api/login'
import Cookies from 'js-cookie'
import { encrypt, decrypt } from '@/utils/jsencrypt'

import EnergyScene from '@/components/EnergyScene'

export default {
  name: 'Login',
  components: { EnergyScene },
  data() {
    return {
      codeUrl: '',
      energyStatus: '能量场已就绪',
      isDemo: process.env.VUE_APP_DEMO === 'true',
      loginForm: {
        username: 'admin',
        password: 'admin123',
        rememberMe: false,
        code: '',
        uuid: ''
      },
      loginRules: {
        username: [
          { required: true, trigger: 'blur', message: '请输入您的账号' }
        ],
        password: [
          { required: true, trigger: 'blur', message: '请输入您的密码' }
        ],
        code: [{ required: true, trigger: 'change', message: '请输入验证码' }]
      },
      loading: false,
      // 验证码开关
      captchaEnabled: true,
      // 注册开关
      register: false,
      redirect: undefined
    }
  },
  watch: {
    $route: {
      handler: function(route) {
        this.redirect = route.query && route.query.redirect
      },
      immediate: true
    }
  },
  created() {
    this.getCode()
    this.getCookie()
  },
  methods: {
    getCode() {
      getCodeImg().then((res) => {
        this.captchaEnabled =
          res.captchaEnabled === undefined ? true : res.captchaEnabled
        if (this.captchaEnabled) {
          this.codeUrl = 'data:' + (res.imageType || 'image/gif') + ';base64,' + res.img
          this.loginForm.code = ''
          this.loginForm.uuid = res.uuid
          this.$nextTick(() => this.$refs.loginForm.clearValidate('code'))
        }
      })
    },
    getCookie() {
      const username = Cookies.get('username')
      const password = Cookies.get('password')
      const rememberMe = Cookies.get('rememberMe')
      this.loginForm = {
        ...this.loginForm,
        username: username === undefined ? this.loginForm.username : username,
        password:
          password === undefined ? this.loginForm.password : decrypt(password),
        rememberMe: rememberMe === undefined ? false : Boolean(rememberMe)
      }
    },
    handleLogin() {
      this.$refs.loginForm.validate((valid) => {
        if (valid) {
          this.loading = true
          if (this.loginForm.rememberMe) {
            Cookies.set('username', this.loginForm.username, { expires: 30 })
            Cookies.set('password', encrypt(this.loginForm.password), {
              expires: 30
            })
            Cookies.set('rememberMe', this.loginForm.rememberMe, {
              expires: 30
            })
          } else {
            Cookies.remove('username')
            Cookies.remove('password')
            Cookies.remove('rememberMe')
          }
          this.$store
            .dispatch('Login', this.loginForm)
            .then(() => {
              this.$router.push({ path: this.redirect || '/' }).catch(() => {})
            })
            .catch(() => {
              this.loading = false
              if (this.captchaEnabled) {
                this.getCode()
              }
            })
        }
      })
    }
  }
}
</script>

<style>

.energy-login{--ec-accent:#64f4e2;--ec-secondary:#758bff;font:14px/1.5 Inter,"Segoe UI","Microsoft YaHei",sans-serif;position:relative;min-height:max(840px,100vh);overflow:hidden;isolation:isolate;border-radius:0;background:#050913;color:#edf8ff;color-scheme:dark}
.energy-login *{box-sizing:border-box}
.energy-login h1,.energy-login h2,.energy-login p{margin:0}
.energy-login button,.energy-login input{font:inherit}
.energy-login button{cursor:pointer}
.energy-login button:focus-visible,.energy-login input:focus-visible{outline:2px solid var(--ec-accent);outline-offset:4px}
.energy-login .ec-atmosphere{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 32% 56%,#073c503d,transparent 48%),radial-gradient(ellipse at 77% 12%,#28266e3f,transparent 52%),linear-gradient(135deg,#07172450,transparent 50%)}
.energy-login .ec-atmosphere:before{content:"";position:absolute;inset:0;background-image:radial-gradient(#91c8d977 .65px,transparent 1px);background-size:61px 79px;opacity:.35;mask-image:linear-gradient(#000,transparent 90%)}
.energy-login .ec-atmosphere:after{content:"";position:absolute;width:1400px;height:190px;left:-650px;top:380px;background:linear-gradient(transparent,#7fa9ff03 45%,#72e5ff0a 50%,#50d6ff03 55%,transparent);transform:rotate(-36deg);filter:blur(8px)}
.energy-login .ec-nav{position:relative;z-index:4;padding:31px 40px;display:flex;justify-content:space-between;align-items:center;gap:18px}
.energy-login .ec-brand{display:flex;align-items:center;gap:11px}
.energy-login .ec-mark{width:37px;height:37px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(130deg,#7be7f721,#717aff15);border:1px solid #a6d5ff2a;box-shadow:inset 0 1px #e0ffff11,0 0 28px #6caaff0c}
.energy-login .ec-mark svg{width:23px;height:23px;color:#b5f6fa}
.energy-login .ec-brand b{display:block;font-size:17px;font-weight:600;letter-spacing:3px}
.energy-login .ec-brand small{display:block;font-size:8px;letter-spacing:2.5px;color:#6d8b9d;margin-top:3px}
.energy-login .ec-nav-right{display:flex;align-items:center;gap:20px;margin-right:72px;font-size:9px;letter-spacing:1px;color:#94aabc}
.energy-login .ec-nav-right>span:first-child{display:flex;align-items:center;gap:7px}
.energy-login .ec-dot{width:5px;height:5px;display:inline-block;background:var(--ec-accent);box-shadow:0 0 9px var(--ec-accent);border-radius:50%}
.energy-login .ec-hero{position:relative;z-index:3;margin:33px 0 0 49px;max-width:54%;pointer-events:none}
.energy-login .ec-hero h1{font-size:52px;font-weight:500;line-height:1.15;letter-spacing:1px;margin-top:20px}
.energy-login .ec-hero h1 span{display:block;margin-top:8px;color:var(--ec-accent);background:linear-gradient(95deg,#e6ffff,var(--ec-accent) 35%,#8d9cff 85%);background-clip:text;-webkit-text-fill-color:transparent}
.energy-login .ec-hero p{font-size:11px;color:#8099ac;letter-spacing:1px;line-height:1.9;margin-top:17px}
.energy-login .ec-ghost-word{position:absolute;left:25px;top:347px;font-size:104px;font-weight:600;letter-spacing:12px;color:#8bc6ff04;pointer-events:none;white-space:nowrap}
.energy-login .ec-stage{position:absolute;left:-42px;top:267px;width:72%;height:477px;z-index:2;overflow:hidden;touch-action:pan-y;mask-image:linear-gradient(90deg,#000 88%,transparent)}
.energy-login .ec-stage canvas{position:absolute;inset:0;display:block;width:100%;height:100%;z-index:2}
.energy-login .ec-fallback{position:absolute;width:247px;height:247px;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid #66ffe6aa;border-radius:50%;background:radial-gradient(circle at 30% 30%,#80f7ff22,#0b2d4c44 45%,#65f9dd1a 65%,#66ffe688 69%,transparent 71%);box-shadow:0 0 35px #39d6ff33,inset 0 0 35px #39d6ff33}
.energy-login .ec-fallback:before,.energy-login .ec-fallback:after{content:"";position:absolute;inset:-45px;border:2px solid #6bf7d799;border-radius:50%;transform:rotateX(60deg) rotateZ(-35deg);box-shadow:0 0 14px #65ffd766}
.energy-login .ec-fallback:after{inset:-25px;transform:rotateY(65deg) rotateZ(25deg);border-color:#878cff99;box-shadow:0 0 14px #878cff66}
.energy-login .ec-ready .ec-fallback{visibility:hidden}
.energy-login .ec-callout{position:absolute;z-index:3;pointer-events:none}
.energy-login .ec-callout small{display:block;font-size:8px;letter-spacing:2px;color:#60879e}
.energy-login .ec-callout strong{font-size:10px;letter-spacing:1.2px;display:flex;align-items:center;gap:7px;margin-top:5px;font-weight:400;color:#a7d3da}
.energy-login .ec-callout:after{content:"";display:block;width:43px;height:1px;background:linear-gradient(90deg,#759eae66,transparent);margin-top:9px}
.energy-login .ec-callout-a{left:43px;top:397px}
.energy-login .ec-callout-b{left:48%;top:578px}
.energy-login .ec-side-caption{position:absolute;z-index:4;left:18px;top:384px;writing-mode:vertical-rl;font-size:8px;letter-spacing:3px;color:#345a6d}
.energy-login .ec-panel-shell{position:absolute;z-index:6;width:312px;right:43px;top:174px;padding:1px;border-radius:20px;background:linear-gradient(140deg,#b5caff5c,#59799016 35%,#566bca2f 70%,#63e5d64f);box-shadow:0 26px 80px #0006}
.energy-login .ec-panel-shell:before{content:"";position:absolute;width:86px;height:1px;left:35px;top:0;background:linear-gradient(90deg,transparent,#bbfff9,transparent);box-shadow:0 0 15px #80fff9}
.energy-login .ec-panel{position:relative;padding:29px 27px 24px;border-radius:19px;overflow:hidden;background:linear-gradient(140deg,#172237fa,#0c1726fc 70%)}
.energy-login .ec-panel:before{content:"";position:absolute;top:-100px;right:-120px;width:250px;height:250px;background:radial-gradient(circle,#7877ff14,transparent 68%);pointer-events:none}
.energy-login .ec-panel-top{display:flex;justify-content:space-between;align-items:center;color:#6d8ba2;font-size:8px;letter-spacing:2px;margin-bottom:12px}
.energy-login .ec-panel-top svg{width:15px;height:15px;color:#b0c5f0}
.energy-login .ec-panel h2{font-size:27px;font-weight:500;letter-spacing:1px;line-height:1.4}
.energy-login .ec-panel .ec-sub{font-size:10px;line-height:1.7;color:#7d92a8;margin-top:7px;margin-bottom:25px}
.energy-login .ec-secure{display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid #728ba51a;padding-top:15px;color:#526f87;font-size:8px;letter-spacing:.5px}
.energy-login .ec-secure svg{width:11px;height:11px}
.energy-login .ec-footer{position:absolute;left:39px;right:39px;bottom:23px;padding-top:19px;border-top:1px solid #7aa9c516;display:flex;align-items:center;justify-content:space-between;gap:16px;z-index:4}
.energy-login .ec-footer-word{font-size:8px;letter-spacing:2.4px;color:#638299}
.energy-login .ec-footer-note{font-size:8px;line-height:1.7;color:#475d75;text-align:right}
.energy-login.ec-paused *{animation-play-state:paused!important}
@keyframes ec-shimmer{0%,65%{left:-80%}100%{left:170%}}
@media(min-width:950px){.energy-login .ec-hero{margin-left:55px;margin-top:30px}.energy-login .ec-hero h1{font-size:57px}.energy-login .ec-panel-shell{right:48px;top:174px;width:318px}.energy-login .ec-panel{padding:30px 29px 24px}.energy-login .ec-stage{left:-21px;top:269px;width:69%;height:475px}.energy-login .ec-callout-a{left:56px;top:399px}.energy-login .ec-callout-b{left:49%;top:582px}.energy-login .ec-scene-tools{left:53px}}
@media(min-width:691px) and (max-width:820px){.energy-login{min-height:820px}.energy-login .ec-hero{margin-left:29px;width:53%}.energy-login .ec-hero h1{font-size:39px}.energy-login .ec-hero p{font-size:10px}.energy-login .ec-panel-shell{right:23px;width:280px;top:174px}.energy-login .ec-panel{padding:27px 22px 22px}.energy-login .ec-stage{left:-60px;top:291px;width:75%;height:447px}.energy-login .ec-callout-a{left:28px;top:388px}.energy-login .ec-callout-b{left:42%;top:586px}.energy-login .ec-scene-tools{left:29px}.energy-login .ec-nav{padding:29px}.energy-login .ec-footer{left:28px;right:28px}.energy-login .ec-footer-word{letter-spacing:1px}}
@media(max-width:690px){.energy-login{min-height:1330px}.energy-login .ec-nav{padding:24px}.energy-login .ec-nav-right{display:none}.energy-login .ec-hero{margin:30px 24px 0;max-width:none;width:calc(100% - 48px)}.energy-login .ec-hero h1{font-size:43px}.energy-login .ec-hero p{font-size:10px;margin-top:15px}.energy-login .ec-eyebrow{font-size:8px;letter-spacing:2px}.energy-login .ec-stage{left:-12%;width:124%;top:282px;height:360px;mask-image:none}.energy-login .ec-callout-a{left:25px;top:343px}.energy-login .ec-callout-b{left:auto;right:22px;top:577px}.energy-login .ec-callout-b small{font-size:7px;letter-spacing:1px}.energy-login .ec-callout-b strong{font-size:8px}.energy-login .ec-side-caption{display:none}.energy-login .ec-scene-tools{left:24px;bottom:auto;top:643px}.energy-login .ec-panel-shell{left:23px;right:23px;top:706px;width:auto}.energy-login .ec-panel{padding:26px 25px 23px}.energy-login .ec-label{margin-top:15px}.energy-login .ec-panel .ec-sub{margin-bottom:17px}.energy-login .ec-field input{font-size:16px}.energy-login .ec-footer{left:24px;right:24px;bottom:21px;flex-wrap:wrap;gap:13px}.energy-login .ec-footer-note{text-align:left}.energy-login .ec-ghost-word{top:400px;left:0;font-size:70px;letter-spacing:4px}}
@media(min-width:691px) and (max-width:820px){.energy-login{min-height:850px}}
@media(max-width:690px){.energy-login{min-height:1410px}}
@media(max-width:360px){.energy-login .ec-hero h1{font-size:36px}.energy-login .ec-panel-shell{left:15px;right:15px}.energy-login .ec-panel{padding:24px 20px 22px}.energy-login .ec-stage{left:-22%;width:144%}.energy-login .ec-footer-word{font-size:7px;letter-spacing:1.7px}}
@media(prefers-reduced-motion:reduce){.energy-login *{animation:none!important;transition:none!important}}
.energy-login .ec-stage[data-dragging="true"] .ec-core-hit{cursor:grabbing}

.energy-login .ec-core-hit{position:absolute;inset:0;z-index:4;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:transparent;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.energy-login .ec-core-hit:focus-visible{outline:1px solid #75c7d55a;outline-offset:-10px;border-radius:15px}
.energy-login .ec-stage canvas{pointer-events:none}
.energy-login .ec-mark img{width:26px;height:26px;object-fit:contain}
.energy-login .ec-eyebrow{font-size:9px;letter-spacing:3px;color:#8db4c5;display:flex;align-items:center;gap:10px}
.energy-login .ec-eyebrow:before{content:"";width:23px;height:1px;background:var(--ec-accent);box-shadow:0 0 10px var(--ec-accent)}
.energy-login .ec-nav-right{margin-right:0}
.energy-login .ec-secure{font-size:11px;padding-top:18px;margin-top:24px}
.energy-login .login-form{position:relative;z-index:1}
.energy-login .login-form .el-form-item{margin-bottom:20px}
.energy-login .login-form .field{display:block;color:#adbdcc;font-size:12px;line-height:18px;margin-bottom:8px}
.energy-login .login-form .el-input__inner{height:46px;line-height:46px;border:1px solid #7386a34d;border-radius:7px;background:#07111fcc;color:#e6f8ff;font-size:14px;padding-left:34px}
.energy-login .login-form .el-input__inner::placeholder{color:#71869d}
.energy-login .login-form .el-input__inner:focus{border-color:#79d8df;box-shadow:0 0 0 3px #64f4e210}
.energy-login .login-form .el-input__prefix,.energy-login .login-form .el-input__suffix{color:#7b9eb8;line-height:46px}
.energy-login .login-form .el-form-item__error{color:#ff9aa8;line-height:1.4;font-size:11px}
.energy-login .field__row{display:flex;align-items:center;gap:10px}
.energy-login .field__row .el-input{flex:1;min-width:0}
.energy-login .login-code{flex:none;width:94px;height:46px;border:1px solid #8caacb4d;border-radius:7px;overflow:hidden;padding:0;background:#152c3b}
.energy-login .login-code-img{width:100%;height:100%;object-fit:fill;display:block}
.energy-login .login-code-hint{display:block;color:#8199af;font-size:11px;line-height:18px;margin-top:5px}
.energy-login .login-options{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:4px 0 22px}
.energy-login .login-options .el-checkbox{color:#9aadc1;font-size:12px}
.energy-login .login-options .el-checkbox__label{font-size:12px;padding-left:6px}
.energy-login .login-options .el-checkbox__inner{background:#0a1828;border-color:#5c7689}
.energy-login .login-options .is-checked .el-checkbox__inner{background:#177b78;border-color:#64f4e2}
.energy-login .login-options .is-checked+.el-checkbox__label{color:#9af8eb}
.energy-login .login-options__hint{font-size:11px;color:#91a1b7}
.energy-login .login-form .login-actions{margin-bottom:0}
.energy-login .login-actions .el-button{width:100%;height:46px;padding:0 16px;border-radius:7px;border:1px solid #d8faff7a;background:linear-gradient(110deg,#99c7ff,#64f4e2);color:#0a2936;box-shadow:0 5px 28px #6be9de22;font-size:13px;font-weight:600;letter-spacing:2px}
.energy-login .login-actions .el-button:hover{filter:brightness(1.08)}
.energy-login .login-actions .el-icon-top-right{margin-left:12px}
.energy-login .login-actions__extra{text-align:right;line-height:20px;margin-top:10px}
.energy-login .login-actions__extra a{color:#8fe9e1;font-size:12px}
.energy-login .ec-core-hit{touch-action:none}
.energy-login .ec-panel-shell{top:155px}
.energy-login .ec-panel .ec-sub{font-size:12px;margin-bottom:24px}
.energy-login .ec-footer-note{font-size:10px;line-height:1.7;color:#8194a8}
@media(min-width:1200px){.energy-login{min-height:max(900px,100vh)}.energy-login .ec-nav{padding:36px 6vw}.energy-login .ec-hero{margin-left:7vw}.energy-login .ec-hero h1{font-size:64px}.energy-login .ec-stage{top:255px;left:0;width:67%;height:580px}.energy-login .ec-panel-shell{right:7vw;top:180px;width:360px}.energy-login .ec-panel{padding:34px}.energy-login .ec-callout-a{left:7vw;top:440px}.energy-login .ec-callout-b{left:49%;top:640px}.energy-login .ec-footer{left:6vw;right:6vw}}
@media(max-width:690px){.energy-login{min-height:1450px}.energy-login .ec-panel-shell{top:706px}.energy-login .login-form .el-input__inner{font-size:16px}.energy-login .ec-secure{margin-top:22px}}
</style>
