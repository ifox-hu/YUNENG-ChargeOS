# 静态 Pages 登录验证码

登录页使用四位数字与字母图片验证码，支持点击图片或键盘刷新、大小写兼容、两分钟有效期、刷新后旧挑战失效。空值、输错、过期和重复提交会阻止演示登录；输错后生成新图片并清空输入。

静态构建由浏览器演示适配器生成和校验验证码，不请求后端，也不持久化验证码答案。代码及答案均在访问者的浏览器内，因此仅用于演示交互，不能作为真实身份认证或防刷措施。现有演示账号逻辑保持浏览器模拟方式。

正式后台继续调用原有 `/code` 和 `/auth/login` 接口，保留后端 GIF 图片格式兼容。修正读取记住密码时覆盖表单、丢失 `code` 和 `uuid` 字段的问题。

验证命令：

```powershell
node --test scripts/test-demo-captcha.cjs
./scripts/build-pages.ps1
node scripts/test-demo-captcha-ui.cjs
node scripts/test-demo-logout.cjs
node scripts/test-original-demo.cjs
node scripts/test-demo-alarms-ui.cjs
```

测试覆盖验证码生成、刷新失效、错误答案、过期、一次性消费、空值拦截、回车登录、键盘刷新、手机布局、子目录部署，以及原有退出登录、菜单和工单流程。浏览器回归通过 SVG 读取演示验证码，仅为自动化操作提供输入。
