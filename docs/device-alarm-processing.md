# 设备告警接入与处理模块

## 能力与边界

本模块在现有故障工单页面提供独立的异步告警入口：运营人员登录后模拟设备事件，先落库，再经 RocketMQ 关联工单。保留原用户报修与同步模拟告警，不替代已有接口。

这是**本地模拟设备接入**，不是已上线的硬件协议网关。第一版不包含设备证书鉴权、站点根因聚合、恢复告警乱序、自动关闭工单或生产容量承诺。

## 处理链路

1. 服务端从设备归属与登录态确定租户及操作者，校验并规范化输入。
2. MySQL 持久化事件，以 `(tenant_id, event_id)` 唯一约束去重。同编号同载荷返回原事件；异载荷拒绝，不能覆盖原文。
3. 投递器通过条件更新抢占发送租约，向独立 Topic 发送内部事件主键；超时或发送失败后退避重试。
4. 消费者在独立 Spring 事务 Bean 内，依次锁定事件、设备和活动工单，原子提交工单关联、告警、日志与 `PROCESSED` 回执。
5. 同设备同类故障的不同事件保留独立事件/告警记录，但复用一张活动工单；不同设备不合并。已处理旧事件不会在工单关闭后重新建单。
6. 发布 ACK 只允许当前租约令牌更新，不能覆盖消费完成状态。消费失败计数独立持久化，并携带重放代次，避免旧失败回写污染新一轮人工重放。

采用**至少一次消息投递 + 业务幂等**，不承诺消息只发送一次或跨数据库/MQ 的 exactly-once。

设备转租后若仍有原租户活动工单，新事件消费拒绝关联，显示失败原因；先通过原租户完成遗留工单，再由有权限人员重放。不会向旧租户工单追加新租户日志。

## 事件状态

| 状态 | 含义 |
| --- | --- |
| PENDING | 已持久化，等待投递或重试 |
| PUBLISHING | 已取得发送租约 |
| SENT | 已发送，等待数据库消费回执 |
| PROCESSED | 工单关联及业务副作用已提交 |
| DEAD | 达到失败上限，停止自动投递，等待排查及授权重放 |

`SENT` 不等于处理完成。发送成功但回执超时会重新投递；重复消费由事件行锁和完成状态检查去重。人工重放只接受 `DEAD`，清零本轮计数、递增代次、记录审计，保留事件编号与原载荷。

## 接口

经网关的统一前缀为 `/prod-api/operator/fault/alarms`。

| 方法/后缀 | 权限 | 说明 |
| --- | --- | --- |
| POST 空后缀 | operator:fault:add | 持久接收事件；成功不代表工单已生成 |
| GET 空后缀 | operator:fault:list | 分页、状态、设备筛选；后端强制租户过滤 |
| GET /{id} | operator:fault:list | 事件详情，非本租户不能读取 |
| POST /{id}/replay | operator:fault:alarm-replay | 失败终止事件重放并记录审计 |

接收示例（设备须真实存在于当前本地数据库）：

```json
{
  "eventId": "SIM-example-unique-event",
  "pileId": "existing-pile-id",
  "faultType": "POWER",
  "priority": "NORMAL",
  "description": "供电异常模拟",
  "occurredAt": "2026-11-04T00:00:00.000Z"
}
```

故障类型：`OFFLINE / CONNECTOR / POWER / OTHER`；优先级：`LOW / NORMAL / HIGH`。描述最多 1000 字，事件及首次工单保留全文，工单时间线日志仅保存不超过 1000 字的摘要。

调用方在超时/响应不明时必须复用原 `eventId` 和发生时间/载荷。页面会锁定首次提交内容并沿用同一事件重试；修改内容需取消后重新新建。响应不明时贸然创建新编号可能被当作另一事件，应先查询原事件。

## 部署与配置

- 在 `fault-work-order.sql` 后增量执行 `yuneng-cloud/docker/device-alarm.sql`。可重复执行；已有事件表会增量增加 `replay_generation`，不清空数据。
- 本地启动脚本已加入迁移；Compose 的 MQ 初始化服务创建 `charge-device-alarm` Topic。
- 告警客户端默认关闭；Compose 为 operator 设置 `HCP_ALARM_MQ_ENABLED=true` 和 `HCP_ALARM_MQ_NAME_SERVER`。
- 独立告警生产者/消费者生命周期，不新增可与积分生产者混淆的同类型 Spring Bean。

配置前缀 `hcp.alarm.mq`：

| 参数 | 默认值 |
| --- | --- |
| enabled | false |
| topic | charge-device-alarm |
| producer-group | charge-device-alarm-producer |
| consumer-group | charge-device-alarm-consumer |
| send-timeout-ms | 3000 |
| lease-seconds | 30 |
| receipt-timeout-seconds | 120 |
| batch-size / scan-ms | 100 / 1000 |
| max-attempts / max-consume-failures | 12 / 12 |
| consumer-threads | 4 |

发送租约必须长于发送超时并留有余量。停止 Broker 后 HTTP 仍可入库，但超长故障可能耗尽重试进入 `DEAD`，不承诺无限自动恢复。授权运营人员应检查错误、修复原因，再执行重放。

## 验证与量化复跑

只在可暂停中间件的专用本地环境执行。`backlog/restart` 及原积分回归会停止容器，不能用于共享/生产环境。

```powershell
# 后端：真实 MySQL 集成测试应先暂停 operator，防止在线消费者抢测试夹具。
docker stop hcp-operator
$env:JAVA_HOME='D:\jdk1.8'
$env:Path='D:\jdk1.8\bin;'+$env:Path
Set-Location D:\xiangmu\huizhi\yuneng-cloud
mvn test '-Dalarm.integration=true'
# 无论成功失败都应恢复 operator；修改业务后需先重新打包/构建镜像。
docker start hcp-operator

Set-Location D:\xiangmu\huizhi
node --test scripts/test-device-alarm-metrics.cjs
node yuneng-cloud/docker/test-device-alarm.cjs
node scripts/test-device-alarm-security.cjs
node scripts/test-device-alarm-ui.cjs
node scripts/benchmark-device-alarms.cjs --devices 1000 --events 1000 --concurrency 64
node scripts/benchmark-device-alarms.cjs --scenario duplicate --devices 1 --events 1000 --concurrency 32
node scripts/test-device-alarm-mq.cjs 1000
node scripts/benchmark-device-alarms.cjs --scenario backlog --devices 100 --events 100 --concurrency 16
node scripts/benchmark-device-alarms.cjs --scenario restart --devices 100 --events 100 --concurrency 16
```

MQ 探针实际参数以脚本为准；测试目录保存真实请求、事件时间戳和逐键对账。HTTP 接收吞吐和事件处理吞吐分别统计，有限批次结果不能替代持续负载容量。恢复观测窗口从启动 Broker 命令开始，到第一次查询确认全部完成，包含启动及轮询时间，不包含后续对账。

脚本只清理自身唯一前缀的设备和业务夹具，事件加锁及依赖删除处于同一事务。原始 JSON/日志保留；失败样本不能手工改成通过。

## 停用与回滚

先设置 `HCP_ALARM_MQ_ENABLED=false` 并重建 operator，停止本模块投递/消费；保留数据库事件及审计以便恢复，勿删表或丢弃积压。若不再接收新告警，应同时撤回新增入口权限或部署原前端/后端版本。已有报修和同步告警继续使用原路径。SQL 为增量变更，不要求删除新列。

部署时替换 operator JAR 并构建对应镜像，前端发布 `yuneng-admin/dist`。若运行目录挂载来自其他旧副本，应先核对容器实际挂载，不能只改另一目录就宣称部署成功。
