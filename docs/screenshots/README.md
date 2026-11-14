# 界面截图说明

## 当前版本（2026-11-15）

品牌横幅、蓝色闪电标识、后台主题和小程序配色按已确认的蓝白款统一。截图来自本项目当前源码构建后的实际页面，没有对截图后期换色。

登录页沿用最新 3D 能量场景，左上角图标、中文品牌和英文副标统一蓝色调；Pages 使用同一登录页实现。管理后台 9 张截图已从本次构建重新采集。

## 运营后台：9 张

| 文件 | 页面 |
| --- | --- |
| admin/login-blue-white.png | 3D 登录页、蓝色品牌与验证码 |
| admin/overview-blue-white.png | 运营首页，平台管理员的“全部运营商”汇总（3 组展示样本） |
| admin/station-list-blue-white.png | 站点列表 |
| admin/order-list-blue-white.png | 原菜单充电订单 |
| admin/device-list-blue-white.png | 模拟充电桩与端口 |
| admin/fault-list-blue-white.png | 故障统计、趋势和工单列表 |
| admin/finance-blue-white.png | 用户余额中的收款与对账 |
| admin/marketing-blue-white.png | 注册用户中的优惠券 |
| admin/alarm-events-blue-white.png | 告警事件面板 |

生成命令：`node scripts/capture-admin-showcase.cjs`。页面数据是隔离浏览器中的模拟数据，不连接真实设备、数据库或 RocketMQ；不作为生产或性能测试证据。采集信息见 admin/capture-manifest.json。

## 小程序：13 张

mini/ 下包含首页距离/价格/智能排序、站点设备、端口选择、订单列表/详情、个人中心、余额、积分、登录、创建报修、我的报修，共 13 张。由当前蓝白小程序源码构建 H5 后，以 390 × 844 视口、2 倍像素采集。

生成命令：`node scripts/capture-mini-h5.cjs`。通过本地演示账号读取开发接口数据，不发起真实支付、充电或报修。它们是 uni-app H5 预览，不能当作微信真机验收截图；Vant Weapp 在 H5 的表现存在差异。采集信息见 mini/capture-manifest.json。

## 历史素材边界

模块 assets/hcp-cloud/ 中保留的上游说明图和 docs/ 中带日期的历史测试材料，不代表当前视觉版本；没有将这些图片冒充本项目新截图。当前展示以仓库首页引用的 22 张截图和本清单为准。上游版权和来源说明保持原样。
