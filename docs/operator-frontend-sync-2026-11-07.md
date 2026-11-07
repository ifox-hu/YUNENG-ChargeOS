# 运营商接入前端同步说明

日期：2026-11-07。

## 同步范围

- 本地运营后台：生产构建部署至现有 Nginx，包含运营商开户、初始密码与充电规则页面；保留生产验证码与真实后端接口。
- 微信小程序：使用已安装的 HBuilderX 5.26 编译器重新生成 `yuneng-mini/unpackage/dist/dev/mp-weixin`；注册页增加运营商编码并通过 `tenantCode` 传给后端。
- H5：重新生成 `yuneng-mini/unpackage/dist/build/h5`，验证注册/登录切换与运营商编码输入。
- GitHub Pages：更新浏览器模拟接口与构建产物，增加充电规则导航、开户、默认规则、白名单添加/移除、目标运营商切换及版本冲突提示；保留验证码、模拟充电与告警/工单演示。

## 演示边界

Pages 的开户与规则操作仅保存在当前浏览器，不创建真实管理员、不发送邮件、不接入真实充电设备或消息队列。初始密码不写入演示 localStorage。新建演示运营商没有真实会员，白名单按已有演示会员归属校验。

微信原生编译成功与 H5 页面验证不等于微信开发者工具、真机测试或微信正式发布；本次不上传微信体验版或生产版本。

## 验证方式

- `node --test scripts/test-demo-operators.cjs scripts/test-demo-alarms.cjs scripts/test-demo-captcha.cjs`：9 项通过。
- `node scripts/test-demo-operators-ui.cjs`：开户、密码不落盘、保存/刷新规则、白名单增删、切换运营商、子目录路由通过，无后端请求和页面运行错误。设置 `DEMO_URL` 可复验线上 Pages。
- `node scripts/test-demo-captcha-ui.cjs`、`node scripts/test-demo-alarms-ui.cjs`、`node scripts/test-demo-logout.cjs`：验证码、告警处理、退出及 Cookie 隔离回归。
- `node scripts/test-original-demo.cjs`：原有页面与站点/工单交互回归。
- `node scripts/test-mini-operator-build.cjs`：微信产物包含编码表单和提交字段；H5 注册切换及输入验证。此项不模拟注册成功，也不替代真实后端的双运营商验收。
- `node yuneng-mini/scripts/test-repair-pages.cjs`、`node yuneng-mini/scripts/test-page-flows.cjs`：原有报修页面及业务页面逻辑回归。

本次没有重跑历史充电、积分、告警吞吐压测；容量与一致性数据继续引用各自原始报告，不能记为新的性能提升。
