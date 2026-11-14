# 本地运营工作台

本轮提供经营仪表盘、异常核查、本地余额付款、部分/全额退款、分账冲正、本地对账及满减券。真实设备、微信支付、提现和渠道对账均不在此范围。

## 部署与入口

1. 按既有开发文档启动 MySQL、Redis、Nacos、网关、认证、system、operator、mp。
2. 在 `vctgo_platform` 执行 `yuneng-cloud/docker/local-operations.sql`。该增量脚本可重复执行，不回填历史付款，不删除业务数据。
3. operator 设置 `HCP_OPERATIONS_LOCAL_ENABLED=true`。默认关闭，当前本地 Compose override 显式开启。会员余额充值另受既有本地充值开关控制。
4. 编译 operator、mp 及其依赖，并将 JAR 放入 Compose 的对应 `jar` 目录后重建服务。仅重启旧镜像不会自动更新 JAR。
5. 管理员在角色管理中授予“运营工作台”的页面权限和“本地运营操作”写权限；不自动向已有普通角色授予财务操作。重新登录刷新权限。
6. 管理后台在 `yuneng-admin` 执行原有开发启动命令，指定端口 8080；代理已连接 `127.0.0.1:38080`。生产构建使用原有 `build:prod`，部署时保留 history 路由的 SPA 回退。
7. Pages 运行 `scripts/build-pages.ps1`，用静态服务器提供 `site/`，通过 `/#/` 路由访问。构建只生成本地文件，不自动发布。

本轮本地入口：`http://127.0.0.1:8080/`（真实后端）、`http://127.0.0.1:8010/site/`（浏览器模拟）。8001 沿用旧静态部署，没有覆盖另一个工作目录的产物。

小程序重新编译后导入 `yuneng-mini/unpackage/dist/dev/mp-weixin`。订单详情增加本地余额付款和选券，会员身份来自服务端 token。编译通过不等于微信真机验收或上传发布。

## 业务口径

- 首页日期按结算日期筛选，未结束订单取创建日期；净收是这些订单截至当前的本地实付减累计退款。它不是按收款发生日汇总的现金流日报。设备和待办为当前快照。
- 订单结算金额不等于扣款。历史无本地付款记录的订单显示“未纳入本地收款”，不能直接退款到账。
- 仅已结束的模拟设备订单（设备类型 4、充电状态 9003、原终态 3/5/7）可付款，校验费用合计并实际扣除本地余额。原结算服务以状态 3 表示结束，因此保留兼容，不能把旧枚举名称当作已有扣款凭证。
- 同订单重复付款不重复扣款；退款以请求号幂等，累计不超过实付。余额变更、流水和付款/退款记录在同一事务中提交。
- 每单最多一张券。部分退款不恢复券；全退恢复券但不延长有效期。零实付只支持撤销核销，不生成正额退款或分账。
- 积分仍按充电完成奖励发放，退款不自动追扣已有积分。
- 分账为平台、站点两方，默认 10%/90%，保存首次分账比例快照。退款按累计剩余金额计算应得并追加冲正，尾差归站点，不修改原分账。
- 对账核对选定业务日创建的本地付款，以及其截至当前的退款、余额流水和分账；保存每次执行的逐笔快照。只检查本地记录，不接入渠道账单。
- 异常核查仅提供备注和重新核查。预占状态不能证明设备未启动，因此页面不提供直接人工取消或强制完成；启停结果仍由原流程确认。
- Pages 的余额、优惠券和流水只在当前浏览器保存。首次种入带 `LOCAL_DEMO_` 标记的体验订单；刷新保留模拟数据，重置恢复初始状态。旧浏览器缓存缺少新流水时建议重置演示，不能反向补造资金证据。

## 验证命令

```powershell
node scripts/verify-local-operations.cjs
node --test scripts/test-demo-operations.cjs scripts/test-demo-operators.cjs scripts/test-demo-alarms.cjs scripts/test-demo-captcha.cjs
node scripts/verify-operations-ui.cjs
node yuneng-mini/scripts/test-repair-pages.cjs
node yuneng-mini/scripts/test-page-flows.cjs
```

真实接口脚本要求本地 Docker 服务及管理员账号，创建独立前缀的租户、会员、订单和回滚探针，结束清理；不要对生产数据库执行。UI 脚本默认真实后台只读、Pages 使用隔离浏览器；可用 `OPERATIONS_SKIP_LIVE=true` 只复验 Pages。脚本证据保存在 `outputs/local-operations/`。
