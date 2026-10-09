<template>
  <div class="login">
    <div class="login__inner">
      <!-- 左侧品牌区 -->
      <section class="brand">
        <span class="brand__ring brand__ring--outer"></span>
        <span class="brand__ring brand__ring--inner"></span>
        <span class="brand__bolt">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
          </svg>
        </span>

        <div class="brand__body">
          <p class="brand__en">Yuneng Smart Charge</p>
          <h1 class="brand__title">让每一台充电桩<br />都稳定在线</h1>
          <p class="brand__desc">
            面向运营商与场站运维的充电桩管理平台，统一接入充电终端、站点、订单与结算数据。
          </p>
          <ul class="brand__stats">
            <li><b>7×24</b><span>设备状态监控</span></li>
            <li><b>全链路</b><span>订单结算追溯</span></li>
            <li><b>秒级</b><span>数据看板刷新</span></li>
          </ul>
        </div>

        <p class="brand__note">数据为方案演示占位，不含真实运营指标</p>
      </section>

      <!-- 右侧登录区 -->
      <section class="panel">
        <div class="panel__brand">
          <span class="panel__mark">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
            </svg>
          </span>
          <span class="panel__wordmark">
            <b>驭能智充</b>
            <i>YUNENG SMART CHARGE</i>
          </span>
        </div>

        <h2 class="panel__title">欢迎登录</h2>
        <p class="panel__sub">请使用平台分配的账号进入运营后台</p>

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

          <el-form-item prop="code" v-if="captchaEnabled">
            <label class="field">验证码</label>
            <div class="field__row">
              <el-input
                v-model="loginForm.code"
                auto-complete="off"
                placeholder="请输入右侧验证码"
                @keyup.enter.native="handleLogin"
              >
                <svg-icon
                  slot="prefix"
                  icon-class="validCode"
                  class="el-input__icon field__icon"
                />
              </el-input>
              <div class="login-code">
                <img :src="codeUrl" @click="getCode" class="login-code-img" />
              </div>
            </div>
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
              <span v-if="!loading">登 录</span>
              <span v-else>登 录 中...</span>
            </el-button>
            <div class="login-actions__extra" v-if="register">
              <router-link class="link-type" :to="'/register'">立即注册</router-link>
            </div>
          </el-form-item>
        </el-form>

        <p class="login-footer">
          Copyright © 2026 驭能智充 · 充电桩运营管理平台<br />
          本页面为设计方案演示，数据均为示例
        </p>
      </section>
    </div>
  </div>
</template>

<script>
import { getCodeImg } from "@/api/login";
import Cookies from "js-cookie";
import { encrypt, decrypt } from "@/utils/jsencrypt";

export default {
  name: "Login",
  data() {
    return {
      codeUrl: "",
      loginForm: {
        username: "admin",
        password: "admin123",
        rememberMe: false,
        code: "",
        uuid: "",
      },
      loginRules: {
        username: [
          { required: true, trigger: "blur", message: "请输入您的账号" },
        ],
        password: [
          { required: true, trigger: "blur", message: "请输入您的密码" },
        ],
        code: [{ required: true, trigger: "change", message: "请输入验证码" }],
      },
      loading: false,
      // 验证码开关
      captchaEnabled: true,
      // 注册开关
      register: false,
      redirect: undefined,
    };
  },
  watch: {
    $route: {
      handler: function (route) {
        this.redirect = route.query && route.query.redirect;
      },
      immediate: true,
    },
  },
  created() {
    this.getCode();
    this.getCookie();
  },
  methods: {
    getCode() {
      getCodeImg().then((res) => {
        this.captchaEnabled =
          res.captchaEnabled === undefined ? true : res.captchaEnabled;
        if (this.captchaEnabled) {
          this.codeUrl = "data:image/gif;base64," + res.img;
          this.loginForm.uuid = res.uuid;
        }
      });
    },
    getCookie() {
      const username = Cookies.get("username");
      const password = Cookies.get("password");
      const rememberMe = Cookies.get("rememberMe");
      this.loginForm = {
        username: username === undefined ? this.loginForm.username : username,
        password:
          password === undefined ? this.loginForm.password : decrypt(password),
        rememberMe: rememberMe === undefined ? false : Boolean(rememberMe),
      };
    },
    handleLogin() {
      this.$refs.loginForm.validate((valid) => {
        if (valid) {
          this.loading = true;
          if (this.loginForm.rememberMe) {
            Cookies.set("username", this.loginForm.username, { expires: 30 });
            Cookies.set("password", encrypt(this.loginForm.password), {
              expires: 30,
            });
            Cookies.set("rememberMe", this.loginForm.rememberMe, {
              expires: 30,
            });
          } else {
            Cookies.remove("username");
            Cookies.remove("password");
            Cookies.remove("rememberMe");
          }
          this.$store
            .dispatch("Login", this.loginForm)
            .then(() => {
              this.$router.push({ path: this.redirect || "/" }).catch(() => {});
            })
            .catch(() => {
              this.loading = false;
              if (this.captchaEnabled) {
                this.getCode();
              }
            });
        }
      });
    },
  },
};
</script>

<style rel="stylesheet/scss" lang="scss">
$brand: #0f9d84;
$text: #1f2733;
$muted: #8b95a7;
$border: #dfe5ee;

.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background: #f4f7f6;
}

.login__inner {
  display: flex;
  width: 100%;
  max-width: 1180px;
  min-height: 600px;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 24px 60px rgba(24, 39, 75, 0.14);
}

/* ---------- 左侧品牌区 ---------- */
.brand {
  position: relative;
  flex: 1.15;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 52px 46px;
  overflow: hidden;
  color: #eafff9;
  background: linear-gradient(160deg, #0d3b36 0%, #0f6b5c 55%, #12907a 100%);

  &__ring {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;

    &--outer {
      right: -90px;
      bottom: -110px;
      width: 340px;
      height: 340px;
      border: 1px solid rgba(255, 255, 255, 0.14);
    }

    &--inner {
      right: -38px;
      bottom: -58px;
      width: 236px;
      height: 236px;
      border: 1px dashed rgba(255, 255, 255, 0.16);
    }
  }

  &__bolt {
    position: absolute;
    right: 56px;
    top: 64px;
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    border-radius: 26px;
    color: #eafff9;
    background: rgba(255, 255, 255, 0.08);

    svg {
      width: 46px;
      height: 46px;
    }
  }

  &__body {
    position: relative;
    margin-top: 60px;
  }

  &__en {
    margin: 0 0 14px;
    font-size: 12px;
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.55;
  }

  &__title {
    margin: 0;
    font-size: 29px;
    line-height: 1.45;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  &__desc {
    max-width: 420px;
    margin: 18px 0 0;
    font-size: 13px;
    line-height: 2;
    opacity: 0.72;
  }

  &__stats {
    display: flex;
    gap: 34px;
    margin: 34px 0 0;
    padding: 0;
    list-style: none;

    li {
      margin: 0;
    }

    b {
      display: block;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    span {
      font-size: 12px;
      opacity: 0.6;
    }
  }

  &__note {
    position: relative;
    margin: 0;
    font-size: 12px;
    opacity: 0.55;
  }
}

/* ---------- 右侧登录区 ---------- */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 48px;

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 26px;
  }

  &__mark {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: #fff;
    background: linear-gradient(140deg, #16c1a3, #0e8d78);

    svg {
      width: 24px;
      height: 24px;
    }
  }

  &__wordmark {
    b {
      display: block;
      font-size: 19px;
      font-weight: 600;
      color: $text;
      letter-spacing: 0.5px;
    }

    i {
      font-style: normal;
      font-size: 11px;
      letter-spacing: 2px;
      color: #93a0b4;
      text-transform: uppercase;
    }
  }

  &__title {
    margin: 0 0 6px;
    font-size: 23px;
    font-weight: 600;
    color: $text;
  }

  &__sub {
    margin: 0 0 26px;
    font-size: 13px;
    color: $muted;
  }
}

/* ---------- 表单 ---------- */
.login-form {
  .el-form-item {
    margin-bottom: 18px;
  }

  .el-input {
    height: 46px;
    line-height: 46px;
    border-radius: 10px;
    background: #fbfcfe;
    border-color: $border;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;

    input {
      height: 46px;
      line-height: 46px;
      font-size: 14px;
      color: $text;
    }

    &:hover {
      border-color: #c6d0dd;
    }

    &:focus,
    &.is-focus {
      border-color: $brand;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(15, 157, 132, 0.14);
    }
  }
}

.field {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 18px;
  color: #6d7789;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;

    .el-input {
      flex: 1;
    }
  }

  &__icon {
    margin-left: 2px;
    color: #5b6579;
    opacity: 0.75;
  }
}

.login-code {
  flex: none;
  width: 116px;
  height: 46px;
  border-radius: 10px;
  overflow: hidden;
  background: #eef1f6;
  border: 1px solid $border;

  img {
    width: 100%;
    height: 100%;
    cursor: pointer;
    vertical-align: middle;
  }
}

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 22px;
  font-size: 13px;
  color: #77808f;

  &__hint {
    font-size: 12px;
    color: #a2abba;
  }
}

.login-actions {
  position: relative;
  margin-bottom: 0;

  .el-button {
    width: 100%;
    height: 48px;
    line-height: 48px;
    font-size: 15px;
    letter-spacing: 4px;
    border-radius: 10px;
    border: 0;
    background: $brand;
    box-shadow: 0 10px 24px rgba(15, 157, 132, 0.28);
    transition: filter 0.2s, transform 0.2s;

    &:hover,
    &:focus {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }

    &--primary.is-active,
    &--primary:focus {
      border-color: $brand;
      background: $brand;
    }
  }

  &__extra {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
}

.link-type {
  font-size: 13px;
  color: $brand;
  text-decoration: none;
}

.login-footer {
  margin: 26px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: #a2abba;
  text-align: center;
}

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .login {
    padding: 0;
    align-items: stretch;
  }

  .login__inner {
    flex-direction: column;
    min-height: 100%;
    border-radius: 0;
  }

  .brand {
    flex: none;
    padding: 34px 26px;
    min-height: 250px;

    &__body {
      margin-top: 0;
    }

    &__title {
      font-size: 23px;
    }

    &__bolt,
    &__ring {
      display: none;
    }

    &__stats {
      margin-top: 20px;
      gap: 24px;
    }

    &__note {
      display: none;
    }
  }

  .panel {
    padding: 30px 22px 44px;
  }
}
</style>
