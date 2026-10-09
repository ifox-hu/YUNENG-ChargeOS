# 充电桩运营与故障工单管理平台

项目仓库：[ifox-hu/YUNENG-ChargeOS](https://github.com/ifox-hu/YUNENG-ChargeOS)。

在线演示：[驭能智充运营后台](https://ifox-hu.github.io/YUNENG-ChargeOS/)（首次 Pages 部署成功后可访问）。演示账号：`demo`，密码：`Demo123456!`。演示使用浏览器模拟接口，不连接后端。

当前公开仓库包含统一说明、三个源码模块、静态演示产物及发布脚本。源码模块在本地仍保留独立 Git 历史，公开仓库中提供可直接浏览和修改的源文件。

基于慧知开源充电平台二次开发的全栈演示项目，覆盖 Java 微服务、Vue 2 运营后台和 uni-app Vue 3 微信小程序。项目重点展示“设备告警/用户报修 → 工单处理 → 用户确认 → 运营统计”的闭环，并补充余额、积分、模拟充电和订单查询能力。

> 本项目用于本地开发、实习项目展示和功能演示。微信支付、短信、真实充电桩协议、生产域名和正式小程序发布仍需独立配置与验收。

## 功能

- **运营后台**：站点、充电桩、端口、计费规则、订单、用户和故障工单管理。
- **故障工单闭环**：模拟设备告警、用户扫码/手动报修、工单分配、处理日志、解决结果、用户确认关闭、近七天统计。
- **小程序充电**：站点浏览、端口选择、模拟开始/结束充电、实时状态、订单和个人中心。
- **账户能力**：余额摘要、余额流水、本地模拟充值；每日签到、订单奖励积分、积分明细和重复操作保护。
- **可靠性设计**：登录会话身份校验、租户隔离、事务状态流转、同设备同类活动工单合并、充值和积分业务幂等。

## 项目结构

```text
huizhi/
├─ huizhi-cloud/        Spring Cloud 后端与 Docker 编排
├─ huizhi-admin/        Vue 2 + Element UI 运营管理后台
├─ huizhi-mini/         uni-app Vue 3 微信小程序
├─ site/                GitHub Pages 静态演示页
└─ README.md            项目统一说明
```

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端 | Java 8 运行时、Spring Boot、Spring Cloud、Nacos、MyBatis-Plus、JdbcTemplate、MySQL 8、Redis |
| 管理后台 | Vue 2、Vue CLI、Element UI、Axios、ECharts |
| 小程序 | uni-app、Vue 3、Vant Weapp、微信开发者工具 |
| 本地运行 | Docker Desktop、Docker Compose、Windows PowerShell |

## 环境要求

- Windows 10/11、Docker Desktop（Linux 容器，数据盘可放在 D 盘）
- JDK 17 和 Maven 3.9 用于本地构建；容器内服务使用 Java 8 JRE
- Node.js、npm、HBuilderX 5.26、微信开发者工具
- Git

仓库中的配置使用相对路径或环境变量，不依赖维护者电脑上的 `D:\xiangmu` 路径。Docker 数据目录、构建产物和本地日志已排除在 Git 提交之外；首次运行请按下面的命令生成镜像或前端产物。

## 快速启动

先启动 Docker Desktop，再运行后端服务：

```powershell
Set-Location D:\xiangmu\huizhi\huizhi-cloud\docker
powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -AllModules
```

常用地址：

| 服务 | 地址 |
| --- | --- |
| 运营后台 | http://127.0.0.1:8001 |
| 网关 | http://127.0.0.1:38080 |
| 小程序 API | http://127.0.0.1:38080/hcp-mp/ |
| Nacos | http://127.0.0.1:8848/nacos |
| MySQL | 127.0.0.1:3307 |

本地演示账号：后台 `admin / admin123`；小程序 `demo / Demo123456!`。这些账号只适用于本地演示，不能直接用于公网环境。

## 编译与部署

### 后端

```powershell
Set-Location D:\xiangmu\huizhi\huizhi-cloud
mvn -pl hcp-modules/hcp-mp -am package -DskipTests
Copy-Item hcp-modules\hcp-mp\target\hcp-mp.jar docker\hcp\modules\mp\jar\hcp-mp.jar -Force
Set-Location docker
docker compose build hcp-mp
docker compose up -d hcp-mp
```

数据库增量脚本位于 `huizhi-cloud/docker/`，包括故障工单和余额积分表。公开仓库前请检查 SQL、Nacos 配置和日志中是否含有真实密码或令牌。

### 管理后台

```powershell
Set-Location D:\xiangmu\huizhi\huizhi-admin
npm ci
npm run build:prod
```

构建后的 `dist` 可复制到后端 Docker 的 Nginx 静态目录，然后重启 `hcp-nginx`。

### 微信小程序

```powershell
Set-Location D:\xiangmu\huizhi\huizhi-mini
npm ci
powershell -ExecutionPolicy Bypass -File .\scripts\compile-local.ps1
```

在微信开发者工具导入：

```text
D:\xiangmu\huizhi\huizhi-mini\unpackage\dist\dev\mp-weixin
```

如果页面出现旧内容或事件跳转错乱，先使用“工具 → 清除缓存 → 清除文件缓存”，再重新编译。

## 主要接口

小程序接口统一使用 `token: Bearer <token>` 请求头：

```text
POST /hcp-mp/v1/auth/account/login
GET  /hcp-mp/wallet/summary
GET  /hcp-mp/wallet/ledger
POST /hcp-mp/wallet/recharge
GET  /hcp-mp/points/summary
GET  /hcp-mp/points/ledger
POST /hcp-mp/points/sign
GET  /hcp-mp/points/orders
POST /hcp-mp/points/orders/{orderId}/claim
POST /hcp-mp/fault/report
GET  /hcp-mp/fault/mine
```

后台工单接口前缀为 `/prod-api/operator/fault`，支持列表、详情、分配、处理、解决、关闭、模拟告警和统计。

## 测试与验证

小程序静态产物检查：

```powershell
& 'C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  'C:\Users\Lenovo\.codex\skills\launch-wechat-miniprogram\scripts\validate_miniprogram_artifacts.py' `
  'D:\xiangmu\huizhi\huizhi-mini'
```

页面流程脚本位于 `huizhi-mini/scripts/`，覆盖登录刷新、页面跳转、报修分页、重复提交、积分/余额入口和返回键。当前已验证小程序编译产物 0 错误、0 警告，后端模块 Maven 构建通过，网关登录、余额查询、幂等充值和重复签到通过。

## GitHub Pages 演示

`site/` 由现有 `huizhi-admin` 后台源码构建，复用同一套登录页、布局、侧边菜单和业务页面；通过独立的 `.env.demo` 开关使用浏览器模拟接口。演示使用 hash 路由及相对资源路径，可部署在 GitHub Pages 的仓库子路径下。日常本地后台继续使用真实接口。

模拟接口覆盖工单查询、告警合并、分配、处理、解决、确认关闭，以及站点等常规列表的查询和增改删。模拟充电桩按钮修改端口演示状态，不产生真实充电。数据保存在浏览器 localStorage，可从顶部“重置数据”恢复。未实现的特殊操作（如真实短信、云存储连接、部分导出）会明确提示，不会连接真实服务。

其他系统菜单保留现有页面，部分列表提供示例记录，部分以空数据展示；不代表所有操作已完成模拟。

已提供 `.github/workflows/pages.yml`。源码推送到 GitHub 的 `master` 或 `main` 分支后，GitHub Actions 会自动发布 `site/` 静态演示。首次部署前，公网演示地址尚未生成；部署成功后可在仓库 Settings → Pages 或 Actions 的部署结果中查看。个人仓库的地址格式通常为 `https://<用户名>.github.io/<仓库名>/`，请以 Pages 设置中显示的地址为准。

演示登录仅在浏览器中创建模拟会话，填写任意非空账号密码即可，例如 `demo / Demo123456!`。演示不连接后端，数据保存在当前浏览器；页面上的短信、微信支付、真实充电等功能不会实际调用外部服务。

重新构建：`powershell -ExecutionPolicy Bypass -File scripts/build-pages.ps1`。先在同级 `huizhi-admin` 安装依赖。统一根仓库保留可直接发布的 site 构建产物；后台演示源码保存于独立的 huizhi-admin 仓库。

本地预览：在项目根目录运行 `python -m http.server 8010 --bind 127.0.0.1`，访问 `http://127.0.0.1:8010/site/`，不要用 file 地址直接打开。演示登录填任意非空账号密码即可，例如 `demo / Demo123456!`；只创建浏览器演示会话，无真实认证。

演示自动化验收脚本：`node scripts/test-original-demo.cjs`（当前使用本机 Playwright 和 Edge，其他机器需调整依赖路径）。脚本验证原版页面路由、工单闭环和无外部服务请求；真实小程序功能截图待补充。

## 公开仓库注意事项

- 不提交 `node_modules`、Docker 数据盘、运行日志、数据库数据目录、私钥和生产密码。
- 保留上游项目许可证和来源说明；本项目的二次开发代码、脚本和页面改动单独记录。
- 本地模拟充值不是真实微信支付，订单写入结算时间也不代表真实扣款。
- 真机调试不能使用电脑的 `127.0.0.1`，需要局域网地址、HTTPS/WSS 和微信公众平台域名配置。

## 许可证与来源

原项目许可证和版权信息以各模块目录中的 `LICENSE` 及上游仓库为准。本项目仅整理本地二次开发成果和演示文档，未声明为原作者官方版本。
