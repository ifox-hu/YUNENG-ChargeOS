# 后台与 Pages 蓝白业务主题

2026-11-15：将已确认的蓝白配色应用到登录后的管理后台，并为 GitHub Pages 重新生成相同主题的演示包。

## 范围

- 公共导航、选中菜单、页签、按钮、表格、筛选表单、卡片和弹窗统一为蓝白风格。
- 主色 `#2563EB`，页面背景 `#F3F6FC`，卡片白色，边框 `#E1E8F3`。
- 新版运营工作台、站点列表、订单列表、设备卡片和故障工单使用同一配色。
- 设备在线、运行、故障、警告等状态保留原有业务语义色。
- 保留远端现有 3D 登录页和交互；未修改 `login.vue` 与 `EnergyScene`。
- 小程序、README 及其中的截图不在本次同步范围。

共享样式位于 `yuneng-admin/src/assets/styles/blue-business.scss`。主题色由 Element UI SCSS 变量和 settings 模块中的默认主题共同控制，旧默认绿/橙主题会迁移为蓝色；其他自定义颜色保持原值。

## 构建与验证

```powershell
./scripts/build-pages.ps1
node --test scripts/test-demo-operations.cjs scripts/test-demo-operators.cjs scripts/test-demo-alarms.cjs scripts/test-demo-captcha.cjs
node scripts/test-original-demo.cjs
node scripts/verify-business-theme.cjs
```

`verify-business-theme.cjs` 默认启动本地静态服务并检查 `site/`。设置 `BUSINESS_URL` 为线上 Pages 根地址（末尾带 `/`）可验证部署后的八个业务页面。

演示数据在隔离浏览器中运行，不向真实后台发送业务写入请求。截图和检查结果输出到 `outputs/blue-white-pages/`。

GitHub Pages 工作流直接上传 `site/`，因此发布主题时必须同时提交源码和重新生成的 `site/` 文件，不能只修改源码。
