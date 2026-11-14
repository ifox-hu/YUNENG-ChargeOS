# 本地运营业务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 完成已确认的本地经营、异常订单、付款退款、分账对账及优惠券闭环。
**Architecture:** 在 hcp-operator 增加运营查询、资金业务、营销服务，复用已有租户、订单和余额表；小程序经内部 Feign API 使用同一资金服务，Pages 提供同契约的显式模拟。
**Tech Stack:** Java 8、Spring Boot 2.7、MySQL、Vue 2、Element UI、ECharts、uni-app。
**Spec:** ../specs/2026-11-14-local-operations-design.md

## Global Constraints
- 不接真实设备、支付、银行、短信，不增加 Java 测试类；保持原模块结构和代码风格。
- 历史无扣款订单不得直接退款到账，金额用十进制到分，租户从登录态取得。
- 增量迁移保留历史业务；不自动提交、推送或发布。

## Review Focus
- 并发和重复付款/退款/核销不得重复变更余额。
- 资源租户、会员、站点一致，跨租户 ID 不得读写。
- 零实付撤销、部分退款和分账冲正保持金额守恒。
- 日期边界、无数据、接口失败不可显示虚构指标。
- 优惠券过期、停发、额度耗尽、全退恢复不造成超发或重复使用。

## Task 1：后端业务与增量迁移
- [x] 创建 docker/local-operations.sql，新增付款、退款、异常处理、分账及对账、优惠券记录与菜单权限。
- [x] 创建 operator/domain/LocalOperationRequest.java、service/LocalFinanceService.java、service/LocalMarketingService.java、service/OperationsOverviewService.java，负责入参、金额事务、券生命周期及查询。
- [x] 创建 controller/LocalOperationsController.java；GET /operations/overview、/orders、/exceptions、/finance、/coupons，POST /operations/pay、/refund、/split、/reconcile、/coupon、/coupon/issue、/exception/action。
- [x] 会员入口通过 RemoteLocalOperationsService 和 mp/controller/LocalOrderPaymentController 复用同一付款核销事务；禁用旧直接改余额接口。
- [x] 独立 scripts/verify-local-operations.cjs 验证重复、并发、余额不足、跨租户、券规则、退款冲正和对账。
- [x] 后端 reactor 编译，专用数据真实 MySQL/API 回归；记录证据和阻塞。

## Task 2：运营界面与小程序
- [x] 新增 api/operator/operations.js、views/operator/operations/{overview,orders,finance,marketing}.vue；首页使用 overview，经营报表保留。
- [x] 图表销毁/缩放、日期筛选、空态、失败重试和下钻；订单资金操作和异常处理均展示结果和日志。
- [x] 财务页支持退款明细、分账快照、冲正和对账差异；营销页支持模板启停、发券及会员券查询。
- [x] 小程序订单详情提供本地支付与优惠券选择，明确显示模拟标识。
- [x] 定向 ESLint、管理后台生产构建、小程序构建或可执行范围检查。

## Task 3：Pages 同步与端到端验证
- [x] 新增 demo/operations.js，复用现有 fixture，金额按整数分计算，模拟完整操作和页面菜单。
- [x] 独立脚本验证 Pages 场景；浏览器验证首页、异常、付款退款、分账对账和营销页面。
- [x] 文档写明迁移、本地开关、启动和业务口径；完成后更新本计划和验证记录。

## 执行记录
- 2026-11-14：用户已确认完整方案并要求开始实现，采用当前会话内执行，不再重复询问执行方式。
- Ruling：设计审阅子代理因运行环境不支持继承的 reasoning effort 启动失败，已自行检查并补全付款终态、累计冲正舍入和零实付撤销规则。

- 最终审查：独立审阅发现两项Important，已修复预占取消判断和默认租户回退；真实12组、模拟12项、组件11项和页面业务验收通过。
- Ruling：原结算使用3/9003，兼容已结束状态3/5/7；人工取消缺少可信设备确认，页面收缩为核查留痕。
- 构建：后台、Pages、小程序成功。镜像重建遇Docker引擎停顿，最后JAR已通过容器内替换后回归；环境恢复状态见验收报告。未提交、推送、发布。

- 2026-11-15：Docker引擎恢复，最终operator、mp镜像分别构建成功并Compose重建；12组API再次通过，真实页面ACTIVE/DEAD待办筛选通过。8001未更新，最新真实入口8080，浏览器模拟8010/site/。
