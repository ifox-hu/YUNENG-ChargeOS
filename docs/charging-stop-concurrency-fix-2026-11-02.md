# 停止充电并发失败修复（2026-11-02）

本文记录 2026-11-02 的故障复现、修复和回归结果。`outputs/` 下的诊断日志、依赖 JAR 和回滚包为本地留档，未随源码发布；结算事件检查以数据库 Outbox 记录为准。现有脚本及运行前提见“当前复现入口”。

## 问题与证据

20 并行模拟充电测试中，首批 20 笔有 19 笔请求 / 断言失败；使用未修改的业务服务再次复现，20/20 失败。复现报告为 `outputs/resume-benchmarks/last-three-20261102/QA3-1793623700330-9bdd56-simulator.json`。

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

复测沿用原连接池、超时配置、并发数和客户端重试设置。

## 历史验证结果

- `scripts/test-charging-stop-contract.ps1`：3 个行为探针通过。使用编译后的真实服务类、Spring 事务代理与 Boot 导入候选加载器，分别验证降级接口类型、停止调用事务边界、自动注册 Bean。
- `mvn -o test`：28 模块 reactor 成功，该次构建没有执行对应的常规 Java 单元测试；业务行为由契约探针和 HTTP 集成脚本检查。
- 受影响的 operator、mp、simulator 打包成功，已更新本地三个服务并验证均就绪。旧包保存在 `outputs/resume-benchmarks/stop-fix-20261102/rollback/`。
- 同条件 20 并行复测通过 20/20；加上场景检查中的 2 笔订单，最终 22 个订单、完成日志和 Outbox 事件核对一致。
- 修复后同类采样 95 次，operator 空闲未提交事务数峰值为 2，修复前为 10；统计范围为诊断探针的采样窗口。
- 保持 20 并行，1,000 笔完整模拟充电循环全部通过，无客户端请求/结算断言失败。每笔均观察真实模拟器的非零充电心跳，再经小程序停止接口触发结算；最终再次逐笔核对电量、金额、电费、服务费及终态。
- 加上 S1/S7 的 2 笔独立场景订单，总计 1,002 笔正金额终态订单、1,002 条完成日志、1,002 个积分 Outbox 事件，数量一致。该批次检查事件生成，未逐笔检查积分到账。
- 1,000 笔测试的 8 类回归场景全部通过，测试夹具清理复核为 0。场景重启范围仍为模拟桩实例，不是容器/进程崩溃恢复。

20 并行成功报告：`outputs/resume-benchmarks/last-three-20261102/QA3-1793624519215-a88ecb-simulator.json`。

1,000 笔成功报告：`outputs/resume-benchmarks/last-three-20261102/QA3-1793624582012-6f2224-simulator.json`。完整执行日志为 `outputs/resume-benchmarks/stop-fix-20261102/simulator-1000-after.log`。

随后串行回归：结算并发 / 末端故障回滚通过；工单 31 组检查及 15/15 非法动作矩阵通过；12 项校验和未接入策略拒绝通过；模拟策略启停 / 重复启动与身份校验通过；两个前端逻辑 / mock 回归通过。日志为同目录 `regression-*.log`。QA3 用户、桩、端口、订单数据库残留均为 0，原有 13 笔历史未完成模拟订单数量保持不变。

最终机器可读汇总：`outputs/resume-benchmarks/stop-fix-20261102/summary.json`。

该批次在本地单实例下完成了 20 并行、1,000 笔模拟充电订单的逐笔对账，未测量真实硬件、长期运行或线上容量。

## 当前复现入口

在专用本地环境编译受影响模块并将包部署到测试服务，再从仓库根目录串行执行。契约探针读取 operator 打包产物，默认 JDK 路径为 `D:/jdk1.8`，可通过 `-JdkPath` 指定；HTTP 脚本依赖本地 Docker 服务及模拟器。

```powershell
./scripts/test-charging-stop-contract.ps1
node scripts/diagnose-charge-stop.cjs after
node scripts/test-resume-last-three.cjs simulator 1000 20
node yuneng-cloud/docker/test-settlement.cjs
node yuneng-cloud/docker/test-fault-flow.cjs
node scripts/test-resume-last-three.cjs validation
```

诊断脚本会额外采样数据库，不能将其耗时作为纯性能压测结果。模拟桩周期使用模拟电量和费用，完整循环不等于真实硬件耐久运行；实例 stop/start 不等于容器崩溃恢复。
