# 静态 Pages 登录验证码

登录页使用四位数字与字母图片验证码，支持点击图片或键盘刷新、大小写兼容、两分钟有效期、刷新后旧挑战失效。空值、输错、过期和重复提交会阻止演示登录；输错后生成新图片并清空输入。

Pages 的验证码由浏览器适配器生成和校验，答案保存在内存中，刷新页面后清除。登录会话同样由浏览器模拟。

连接后端运行时，登录页调用服务端 `/code` 和 `/auth/login` 接口，兼容 GIF 图片验证码。读取记住的账号密码时保留表单中的 `code` 和 `uuid` 字段。

在仓库根目录执行以下验证命令。浏览器脚本需要 Playwright 与 Edge，构建前需安装后台依赖。

```powershell
node --test scripts/test-demo-captcha.cjs
./scripts/build-pages.ps1
node scripts/test-demo-captcha-ui.cjs
node scripts/test-demo-logout.cjs
node scripts/test-original-demo.cjs
node scripts/test-demo-alarms-ui.cjs
```

测试覆盖验证码生成、刷新失效、错误答案、过期、一次性消费、空值拦截、回车登录、键盘刷新、手机布局、子目录部署，以及原有退出登录、菜单和工单流程。浏览器回归通过 SVG 读取演示验证码，仅为自动化操作提供输入。
