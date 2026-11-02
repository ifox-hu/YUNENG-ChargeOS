# 停止充电并发失败修复（2026-11-02）

> 发布范围：本次提交包含停止充电修复、契约探针、集成回归脚本和本说明。下文 `outputs/` 路径指本地测试留档，未随源码发布；原始数据库诊断、依赖 JAR 和回滚包仅保存在本地。结算事件的断言针对 Outbox 记录，不依赖本次提交切换 MQ 实现。

## 问题与证据

原测试在 20 并行模拟充电时首批 20 笔有 19 笔请求/断言失败。再次使用未修改的业务服务复现，20/20 失败；失败报告为 `outputs/resume-benchmarks/last-three-20261102/QA3-1793623700330-9bdd56-simulator.json`。两次失败均保留，不能被后续成功覆盖。

复现时另外运行只读数据库采样。北京时间 20:49:04 起，operator 的 10 个连接均为 Sleep，但对应 10 个事务仍为 RUNNING，各有 1 行修改未提交；同一采样时刻 `data_lock_waits=0`。本地原配置 `maxActive=10`。结合实际调用链和事务回归探针，确认停止流程占满连接后同步等待模拟桩，模拟桩结算回调又需要 operator 数据库连接，形成资源等待，随后触发约 10 秒的远程读取超时。

另一个独立错误是 `RemoteChargingService` 配置了返回 `RemoteMpService` 的降级工厂。超时进入降级时，Sentinel 在不兼容的对象上反射调用充电接口，出现 `object is not an instance of declaring class`。正确工厂原本存在，但没有列入模块的 Boot 自动配置导入清单。

原始证据在 `outputs/resume-benchmarks/stop-fix-20261102/`：

- `before-1793623700217.log`：相同 20 并行条件下的失败复现。
- `db-1793623700217.jsonl`：83 份数据库采样，包含连接、事务及锁等待。
- `red-fallback.log`：错误降级对象不能实现充电接口的失败探针。
- `red-stop.log`：停止 RPC 持有活动事务的失败探针。
- `red-registration.log`：正确工厂没有注册为 Spring Bean 的失败探针。

## 最小修复

只修改 3 个业务源文件/资源：

1. `RemoteChargingService.java`：改为使用 `RemoteChargingFallbackFactory`。
2. `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`：注册正确工厂，使各消费模块能获得对应 Bean。
3. `ChargingOrderServiceImpl.stopChargingOrder`：移除覆盖整个停止流程的事务。查询与停止请求日志写入完成后，再调用设备策略，避免等待远程服务时占有事务连接。

停止请求日志采用单条 INSERT 自动提交。若设备响应超时，该日志仍保留，表示曾发起停止请求，不代表已完成结算。真正的完成日志、订单终态、积分 Outbox 仍由原有带行锁的结算事务原子写入；没有更改终态校验、结算金额计算、MQ 补偿参数或索引。

没有通过增加连接池、延长超时、降低并发或增加客户端重试来通过测试。

## 已验证项目

- `scripts/test-charging-stop-contract.ps1`：3 个行为探针通过。使用编译后的真实服务类、Spring 事务代理与 Boot 导入候选加载器，分别验证降级接口类型、停止调用事务边界、自动注册 Bean。
- `mvn -o test`：最终 28 模块 reactor 成功。仓库没有对应的常规 Java 单元测试，因此 `No tests to run` 不代表业务回归已执行；业务证据由上述探针和实际 HTTP 集成脚本补充。
- 受影响的 operator、mp、simulator 打包成功，已更新本地三个服务并验证均就绪。旧包保存在 `outputs/resume-benchmarks/stop-fix-20261102/rollback/`。
- 同条件 20 并行复测通过 20/20；加上场景检查中的 2 笔订单，最终 22 个订单、完成日志和 Outbox 事件核对一致。
- 修复后同类采样 95 次，operator 空闲未提交事务数峰值为 2，修复前为 10。这是整个探针窗口的采样统计，不是连接池使用率或系统容量指标。
- 保持 20 并行，1,000 笔完整模拟充电循环全部通过，无客户端请求/结算断言失败。每笔均观察真实模拟器的非零充电心跳，再经小程序停止接口触发结算；最终再次逐笔核对电量、金额、电费、服务费及终态。
- 加上 S1/S7 的 2 笔独立场景订单，总计 1,002 笔正金额终态订单、1,002 条完成日志、1,002 个积分 Outbox 事件，数量一致。此处只证明积分事件随结算产生，不将其描述为 1,002 笔积分全部发奖的独立测试。
- 1,000 笔测试的 8 类回归场景全部通过，测试夹具清理复核为 0。场景重启范围仍为模拟桩实例，不是容器/进程崩溃恢复。

20 并行成功报告：`outputs/resume-benchmarks/last-three-20261102/QA3-1793624519215-a88ecb-simulator.json`。

1,000 笔成功报告：`outputs/resume-benchmarks/last-three-20261102/QA3-1793624582012-6f2224-simulator.json`。完整执行日志为 `outputs/resume-benchmarks/stop-fix-20261102/simulator-1000-after.log`。

结束后串行重跑：结算并发/末端故障回滚通过；工单 31 组检查及 15/15 非法动作矩阵通过；12 项校验和未接入策略拒绝通过；模拟策略启停/重复启动与身份校验通过；两个前端逻辑/mock 回归通过。日志为同目录 `regression-*.log`。QA3 用户、桩、端口、订单数据库残留均为 0，原有 13 笔历史未完成模拟订单数量保持不变。三个更新服务持续运行。

最终机器可读汇总：`outputs/resume-benchmarks/stop-fix-20261102/summary.json`。

这次结果支持“本地单实例、20 并行、1,000 笔完整模拟充电订单逐笔对账零异常”。不代表真实设备、长时间耐久或线上容量；没有为工单查询“812 ms→172 ms”的说法补充任何新证据。

## 复现命令

先编译受影响模块并将包部署到本地测试服务，然后串行执行：

```powershell
./scripts/test-charging-stop-contract.ps1
node scripts/diagnose-charge-stop.cjs after
node scripts/test-resume-last-three.cjs simulator 1000 20
node yuneng-cloud/docker/test-settlement.cjs
node yuneng-cloud/docker/test-fault-flow.cjs
node scripts/test-resume-last-three.cjs validation
```

诊断脚本会额外采样数据库，不能将其耗时作为纯性能压测结果。模拟桩周期使用模拟电量和费用，完整循环不等于真实硬件耐久运行；实例 stop/start 不等于容器崩溃恢复。
