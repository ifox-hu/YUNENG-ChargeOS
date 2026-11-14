# 本地运营改造验收记录

实施始于2026-11-14，恢复及最终复验于2026-11-15完成。本轮不自动提交、推送或发布，没有新增 Java 测试类。

## 已通过

| 验证 | 实际结果与边界 |
| --- | --- |
| Java reactor package | operator、mp 及依赖构建成功；使用 Java 8，跳过已移除的 Java 测试目录 |
| 真实 HTTP/MySQL 回归 | 12 组通过：查询、认证/租户隔离、发券配额与重试、8 并发重复付款、余额不足、历史未扣款拒退、并发退款、券竞争、异常留痕、预占拒绝直接取消、旧完成状态付款、小程序 token 身份、对账、末端流水失败整体回滚 |
| 浏览器模拟逻辑 | 新增付款/退款/分账/券/对账差异检测与原有运营商、告警、验证码，共 12 项通过 |
| 独立前端组件检查 | 另一会话只读复验 11 项通过：三页乱序成功/失败/loading、详情和可用券跨租户延迟响应；属于组件脚本验证 |
| 真实后台浏览器 | 仪表盘真实空态、异常筛选、订单详情、财务、营销页面通过；故障ACTIVE、积分DEAD待办实际携带租户筛选，积分弹窗自动打开；真实页面验收不操作现有会员资金 |
| Pages 浏览器 | 实际操作付款20元→分账→部分退款5元→剩余退款15元→追加两次冲正→逐笔对账差异0；建券/发券、切换空租户、1366px页面检查通过，无真实后端请求、无页面运行错误 |
| 管理后台/Pages | 两类生产构建通过；定向 ESLint 通过 |
| 小程序 | HBuilderX 5.26 Vue3 编译为 mp-weixin 成功；原有报修及业务流程脚本通过；未做微信开发者工具和真机付款验收 |
| history 路由 | 8080 的 overview/finance 在浏览器 HTML 请求下返回200；无 Accept 请求的开发服务器404不等于浏览器刷新失败 |

真实接口的 12 组为场景分组，包含多条断言，不是新的吞吐量或性能指标。没有重跑10万工单性能、积分积压吞吐或硬件协议压测。

## 审查后的实施决定

1. 原模拟结算代码把订单设为 `3/9003`，将其与 `5/7` 一起作为可显式付款的已结束订单，原终态不回退；不自动认定历史订单已扣款。
2. 预占订单也处于 `1/9001`，无法靠无错误文本证明设备未启动。因此缩小人工处理为核查留痕，活动预占不能直接取消。需要可信设备结果才能扩展此操作。
3. 仪表盘金额和订单数分轴，电量独立指标展示；未显式选租户时交给后端从登录态确定，避免刷新误选9999。
4. 测试仍使用独立 Node 脚本，没有恢复 Java 测试类。

## 证据与部署状态

- `outputs/local-operations-verify-final.log`：真实接口12组PASS，测试数据结束清理。
- `outputs/local-operations-demo-tests.log`：12项模拟逻辑检查。
- `outputs/local-operations-ui-final.log`、`outputs/local-operations/ui-result.json`：真实后台与Pages浏览器业务结果；截图见同目录。
- `outputs/local-operations-mini-build.log`：最终微信小程序构建成功。首次用系统Node出现cachedDataRejected，切换HBuilderX自带Node后通过。
- `outputs/local-operations-admin-build.log`、`outputs/local-operations-pages-build.log`：最终两类前端构建成功。
- 镜像重建曾在传输上下文时取消/停顿，Docker引擎接口返回500，普通restart超时。仅终止docker-desktop发行版并重新启动Docker后恢复；2026-11-15最终operator、mp分别构建成功，日志为 `outputs/local-operations-operator-image-final.log` 和 `outputs/local-operations-mp-image-final.log`，通过Compose重新创建服务。
- 8001没有更新；当前代码的开发入口是8080，Pages本地入口8010。Docker停顿后网关曾超时；恢复后按MySQL→Nacos→应用的依赖顺序重新启动；网关验证码入口返回200，12组真实接口和页面待办复验通过。

所有截图和日志为本地验收产物，没有推送到GitHub。设备接入、真实支付/提现、渠道对账、发票、PLUS、团充、IC卡、原生微信真机验证不在本轮已完成范围。
