# 后台与 Pages 蓝白业务主题

2026-11-15：将已确认的蓝白配色应用到登录后的管理后台，并为 GitHub Pages 重新生成相同主题的演示包。

## 范围

- 公共导航、选中菜单、页签、按钮、表格、筛选表单、卡片和弹窗统一为蓝白风格。
- 主色 `#2563EB`，页面背景 `#F3F6FC`，卡片白色，边框 `#E1E8F3`。
- 经营概览、原菜单内的异常核查/资金/优惠券、站点列表、订单列表、设备卡片和故障工单使用同一配色。
- 设备在线、运行、故障、警告等状态保留原有业务语义色。
- 保留远端现有 3D 登录页和交互；未修改 `login.vue` 与 `EnergyScene`。
- 2026-11-15 补齐小程序蓝白配色、品牌入口、README 横幅和后台/小程序截图（22 张）的同步。

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

## 最终版基准（2026-11-15）

用户确认以 127.0.0.1:8080/operate/fault 的截图蓝白款为最终视觉。主色、浅蓝背景、白色导航/卡片、选中项和标签沿用当前共享主题，不另建视觉方案。

本次将本地已验证的原菜单整合页面作为发布输入快照：异常核查位于充电订单，收款与对账位于用户余额，优惠券位于注册用户；旧 operations 链接兼容跳转。保留线上现有 3D 登录组件。

唯一发布构建来源为 preview/blue-white-business 分支；由此同时生成生产后台与 site/ 演示包。8080 是业务开发 worktree 的实时服务；8001 是生产静态后台；GitHub Pages 使用 site/。演示数据和真实后台数据不同，不以数值一致作为验收条件。后续发布应先合入该分支的主题与整合页面，避免旧 worktree 构建覆盖最终版。

### 本次同步验证

- 18 项资金、演示、租户、验证码和页面生命周期单元回归通过。
- Pages 八个业务视图主题验证通过：蓝色主色、白色激活标签、原菜单结构、无页面异常或后台请求。
- 原菜单页面遍历、站点增改删、工单闭环、子路径登录通过。
- 8080 与 8001 实际后台只读验证通过；8010 演示付款、分账、退款、对账、发券和旧入口跳转通过。
- 本地静态部署已先备份到系统临时目录 yuneng-final-blue-backup-20261115-013246；未覆盖其他 worktree 的业务源码。

## 品牌与文档补齐（2026-11-15）

- favicon 使用新路径 yuneng-blue.svg 避免沿用旧缓存，同时更新 ICO 回退图标；登录品牌与表单设计器使用共享蓝色闪电 SVG，修复页面标题重复品牌。
- README 横幅换为蓝白版本；后台 9 张、小程序 13 张截图从当前构建重新采集并核对，清单见 screenshots/README.md。移除 README 使用的两张旧后台图片。
- 小程序公共主题、页面品牌配色、选中图标和登录标识统一，保留业务状态色和原业务逻辑。H5 与 mp-weixin 构建通过；注册切换/编码字段回归通过，尚不等于微信真机或发布验收。
- 常用原目录 D:/xiangmu/huizhi/yuneng-mini 已通过补丁检查同步本次主题改动，并同步生成的 H5/微信构建目录；8080 开发入口仅补齐品牌、图标与标题，保留该 worktree 页面逻辑。
- 本地 8001 与 8010 静态产物由当前 worktree 构建同步。README 链接、截图清单和线上资源作为最终复核项。

## 左上角品牌布局修正（2026-11-15）

- 根因是全局 #app .sidebar-container a 把组件链接覆盖为 inline-block，导致 flex 间距失效；原始 !important 对齐声明也阻止了折叠居中。
- 在 Sidebar/Logo.vue 内修正组件选择器层级，去除冲突的强制对齐；沿用 50px 全局顶栏高度，图标 32px，图文间距 12px，水平内边距 20px，文字 18px/26px，折叠后居中。
- scripts/test-sidebar-brand-layout.cjs 在旧线上版本复现失败（inline-block），修正版本通过桌面、150% 等效缩放和手机菜单，以及展开/折叠的实际几何检查；不触碰菜单业务功能。
- 本地 8080 只在确认组件与修改前基线相同时同步该文件；8001 与 Pages 使用同源构建，同时更新 README 的后台截图。

## 顶部导航交互与项目入口（2026-11-15）

- “更多菜单”原本使用横向菜单默认的 hover 触发，标题点击不会切换关闭。改为 click 触发，补齐点击菜单外部、Esc 和窗口尺寸变化时关闭；选中菜单项继续沿用组件本身的收起逻辑。事件监听在组件销毁时解除。
- 顶栏三个图标分别为“项目仓库”“项目文档”“问题反馈”，链接全部指向 ifox-hu/YUNENG-ChargeOS 的仓库、开发部署文档及 Issues；不再链接上游仓库、上游文档站或个人主页。许可证与来源声明保留。
- `node scripts/test-navbar-actions.cjs` 覆盖 1440、1280、390 像素视口的点击开关、外部点击、Esc、选择菜单项，以及三个入口的提示与打开地址。修复前已复现再次点击不能关闭，修复后按同一操作验证。
- 设置 `NAVBAR_URL` 可验证已部署的 Pages；本地后台另设 `NAVBAR_LIVE=true`，使用现有本地管理账号作只读检查，不提交业务写入。
