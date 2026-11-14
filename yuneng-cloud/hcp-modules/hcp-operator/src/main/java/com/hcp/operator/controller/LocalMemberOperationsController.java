package com.hcp.operator.controller;

import com.hcp.common.core.domain.R;
import com.hcp.common.security.annotation.InnerAuth;
import com.hcp.operator.domain.LocalOperationRequest;
import com.hcp.operator.service.*;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/operations/internal")
public class LocalMemberOperationsController
{
    private final LocalOperationSupport support;
    private final LocalFinanceService finance;
    private final LocalMarketingService marketing;
    private final OperationsOverviewService overview;

    public LocalMemberOperationsController(LocalOperationSupport support, LocalFinanceService finance,
                                           LocalMarketingService marketing, OperationsOverviewService overview)
    {
        this.support = support; this.finance = finance; this.marketing = marketing; this.overview = overview;
    }

    private Long tenant(Long memberId)
    {
        return ((Number)support.one("SELECT tenant_id FROM c_member WHERE member_id=?", memberId).get("tenant_id")).longValue();
    }

    @InnerAuth
    @GetMapping("/order/{orderId}")
    public R<Map<String, Object>> detail(@PathVariable String orderId, @RequestParam Long memberId)
    {
        Long tenant = tenant(memberId);
        support.one("SELECT order_id FROM c_charging_order WHERE order_id=? AND user_id=? AND tenant_id=?", orderId, memberId, tenant);
        Map<String, Object> result = overview.detail(tenant, orderId);
        result.put("coupons", marketing.list(tenant, memberId, 1, 1).get("coupons"));
        return R.ok(result);
    }

    @InnerAuth
    @PostMapping("/pay")
    public R<Map<String, Object>> pay(@RequestBody LocalOperationRequest request, @RequestParam Long memberId)
    {
        return R.ok(finance.pay(tenant(memberId), memberId, request));
    }
}
