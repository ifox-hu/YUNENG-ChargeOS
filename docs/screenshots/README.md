# 界面截图说明

## 采集日期：2026-11-15

截图来自蓝白主题的运营后台和小程序 H5 页面，共 26 张。后台使用 Pages 演示数据，小程序连接本地开发接口。

## 运营后台：13 张

| 文件 | 页面 |
| --- | --- |
| admin/login-blue-white.png | 3D 登录页、金属轨道、蓝色品牌与验证码 |
| admin/overview-blue-white.png | 新版仪表盘，全部运营商 / 全部站点、日期筛选、快捷入口与经营分析 |
| admin/statistics-blue-white.png | 经营统计 |
| admin/map-blue-white.png | 桩分布、区域地图与 24 个内置演示站点的示意点位（非真实定位） |
| admin/screen-blue-white.png | 全屏运营数据大屏，含标注为演示的示意点位 |
| admin/station-list-blue-white.png | 站点列表 |
| admin/order-list-blue-white.png | 原菜单充电订单 |
| admin/device-list-blue-white.png | 模拟充电桩与端口 |
| admin/fault-list-blue-white.png | 故障统计、趋势和工单列表 |
| admin/finance-blue-white.png | 用户余额中的收款与对账 |
| admin/marketing-blue-white.png | 注册用户中的优惠券 |
| admin/alarm-events-blue-white.png | 告警事件面板 |
| admin/operator-onboarding-blue-white.png | 运营商开户表单（仅打开，未提交） |

在仓库根目录先执行 `powershell -ExecutionPolicy Bypass -File scripts/build-pages.ps1`，再运行 `node scripts/capture-admin-showcase.cjs`。脚本使用隔离浏览器中的模拟数据，检查登录、快捷入口、全屏布局及收款 / 优惠券页面，同时记录脚本错误、失败资源和外部请求。采集信息及构建首页 SHA-256 见 [admin/capture-manifest.json](admin/capture-manifest.json)。

## 小程序：13 张

mini/ 下包含首页距离/价格/智能排序、站点设备、端口选择、订单列表/详情、个人中心、余额、积分、登录、创建报修、我的报修，共 13 张。由当前蓝白小程序源码构建 H5 后，以 390 × 844 视口、2 倍像素采集。

在仓库根目录运行 `node scripts/capture-mini-h5.cjs`。脚本使用本地演示账号读取已有数据，采集时不提交支付、启充或报修操作。Vant Weapp 等微信专用组件需在微信端另行检查。采集信息见 [mini/capture-manifest.json](mini/capture-manifest.json)。

## 上游素材

`assets/hcp-cloud/` 中保留上游说明图；仓库首页的界面预览使用本清单中的截图。上游素材的版权及来源见其原有说明。
