# 首页与运营商样本

## 页面分工

- **运营首页**：快速查看经营概览、趋势、设备状态、站点排行和待办入口。
- **经营管理**：继续提供站点/设备明细筛选、统计表格和导出。两页保留必要的汇总指标交集，首页增加分工提示，本次未重做经营管理。

## 使用方式

在首页的“运营商视图”选择城区快充、校园慢充或园区运营。三组样本的站点、订单规模、金额、充电量、设备状态与待办数量不同，可筛选站点及最近 7 / 30 天，或在最近 30 天内自定义日期。更早日期没有订单样本。

默认仍为“当前运营商数据”。切回该项后沿用原接口与当前运营商条件。样本不会切换账号或修改租户权限，也不会扩展其他业务页的数据范围。

样本由 `yuneng-admin/src/demo/dashboard-samples.js` 在浏览器生成，日期随当前日期滚动。它们只用于首页展示，不创建真实租户、订单、设备、收款或资金流水，不写浏览器演示数据库。样本待办不可点击，避免把示例标识传入业务操作。本地后台与 Pages 使用同一份样本生成逻辑，页面有明确的非实际业务提示。

## 复现与验证

```powershell
node --test scripts/test-dashboard-samples.cjs scripts/test-demo-operations.cjs scripts/test-operations-lifecycle.cjs
./scripts/build-pages.ps1
node scripts/test-dashboard-samples-ui.cjs
node scripts/capture-admin-showcase.cjs
```

界面验证覆盖三组样本、站点筛选、恢复原数据、无后端样本请求、演示数据不变及手机端下拉选择。截图脚本在采集首页时选择城区示例，采集后恢复当前数据，再继续其他业务页；README 的首页截图不是实际经营业绩。
