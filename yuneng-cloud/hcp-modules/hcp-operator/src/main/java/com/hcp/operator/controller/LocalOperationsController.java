package com.hcp.operator.controller;

import com.hcp.common.core.domain.R;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.operator.domain.LocalOperationRequest;
import com.hcp.operator.service.*;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

/** 本地运营工作台，写操作始终校验权限和本地开关。 */
@RestController
@RequestMapping("/operations")
public class LocalOperationsController
{
    private final LocalOperationSupport support;
    private final OperationsOverviewService overview;
    private final LocalFinanceService finance;
    private final LocalMarketingService marketing;

    public LocalOperationsController(LocalOperationSupport support, OperationsOverviewService overview,
                                     LocalFinanceService finance, LocalMarketingService marketing)
    {
        this.support = support; this.overview = overview; this.finance = finance; this.marketing = marketing;
    }

    @GetMapping("/overview")
    @RequiresPermissions("operator:operations:view")
    public R<Map<String, Object>> overview(@RequestParam(required=false) Long targetTenantId,
        @RequestParam(required=false) String from, @RequestParam(required=false) String to, @RequestParam(required=false) Long stationId)
    {
        return R.ok(overview.overview(support.tenant(targetTenantId), from, to, stationId));
    }

    @GetMapping({"/orders", "/exceptions"})
    @RequiresPermissions("operator:operations:orders")
    public R<Map<String, Object>> orders(@RequestParam(required=false) Long targetTenantId,
        @RequestParam(defaultValue="false") boolean exceptions, @RequestParam(required=false) String keyword,
        @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="10") int size)
    {
        return R.ok(overview.orders(support.tenant(targetTenantId), exceptions, keyword, page, size));
    }

    @GetMapping("/orders/{orderId}")
    @RequiresPermissions("operator:operations:orders")
    public R<Map<String, Object>> detail(@PathVariable String orderId, @RequestParam(required=false) Long targetTenantId)
    {
        return R.ok(overview.detail(support.tenant(targetTenantId), orderId));
    }

    @GetMapping("/finance")
    @RequiresPermissions("operator:operations:finance")
    public R<Map<String, Object>> finance(@RequestParam(required=false) Long targetTenantId,
        @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="10") int size)
    {
        return R.ok(finance.list(support.tenant(targetTenantId), page, size));
    }

    @GetMapping("/coupons")
    @RequiresPermissions("operator:operations:marketing")
    public R<Map<String, Object>> coupons(@RequestParam(required=false) Long targetTenantId, @RequestParam(required=false) Long memberId,
        @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="10") int size)
    {
        return R.ok(marketing.list(support.tenant(targetTenantId), memberId, page, size));
    }

    @PostMapping("/pay")
    @RequiresPermissions("operator:operations:write")
    public R<Map<String, Object>> pay(@RequestBody LocalOperationRequest request)
    {
        return R.ok(finance.pay(support.tenant(request.getTargetTenantId()), null, request));
    }

    @PostMapping("/refund")
    @RequiresPermissions("operator:operations:write")
    public R<Map<String, Object>> refund(@RequestBody LocalOperationRequest request)
    {
        return R.ok(finance.refund(support.tenant(request.getTargetTenantId()), SecurityUtils.getUserId(), request));
    }

    @PostMapping("/void")
    @RequiresPermissions("operator:operations:write")
    public R<Void> cancelZero(@RequestBody LocalOperationRequest request)
    {
        finance.cancelZero(support.tenant(request.getTargetTenantId()), SecurityUtils.getUserId(), request); return R.ok();
    }

    @PostMapping("/split")
    @RequiresPermissions("operator:operations:write")
    public R<Void> split(@RequestBody LocalOperationRequest request)
    {
        finance.split(support.tenant(request.getTargetTenantId()), request.getOrderId()); return R.ok();
    }

    @PostMapping("/split/rule")
    @RequiresPermissions("operator:operations:write")
    public R<Void> rule(@RequestBody LocalOperationRequest request)
    {
        finance.saveRule(support.tenant(request.getTargetTenantId()), request); return R.ok();
    }

    @PostMapping("/reconcile")
    @RequiresPermissions("operator:operations:write")
    public R<Map<String, Object>> reconcile(@RequestBody LocalOperationRequest request) throws Exception
    {
        support.requireLocal();
        return R.ok(finance.reconcile(support.tenant(request.getTargetTenantId()), SecurityUtils.getUserId(), request.getBusinessDay()));
    }

    @PostMapping("/reconcile/note")
    @RequiresPermissions("operator:operations:write")
    public R<Void> note(@RequestBody LocalOperationRequest request)
    {
        finance.note(support.tenant(request.getTargetTenantId()), SecurityUtils.getUserId(), request); return R.ok();
    }

    @PostMapping("/coupon")
    @RequiresPermissions("operator:operations:write")
    public R<Void> coupon(@RequestBody LocalOperationRequest request)
    {
        marketing.save(support.tenant(request.getTargetTenantId()), request); return R.ok();
    }

    @PostMapping("/coupon/issue")
    @RequiresPermissions("operator:operations:write")
    public R<Map<String, Object>> issue(@RequestBody LocalOperationRequest request)
    {
        return R.ok(marketing.issue(support.tenant(request.getTargetTenantId()), request));
    }

    @PostMapping("/exception/action")
    @RequiresPermissions("operator:operations:write")
    public R<Void> handle(@RequestBody LocalOperationRequest request)
    {
        overview.handle(support.tenant(request.getTargetTenantId()), SecurityUtils.getUserId(), request.getOrderId(), request.getAction(), request.getReason()); return R.ok();
    }
}
