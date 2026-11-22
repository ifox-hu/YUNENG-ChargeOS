package com.hcp.operator.controller;

import com.hcp.common.core.web.domain.AjaxResult;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.operator.service.OperationsDashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/overview")
public class OperationsOverviewController
{
    private final OperationsDashboardService dashboardService;

    public OperationsOverviewController(OperationsDashboardService dashboardService)
    {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    @RequiresPermissions("operator:station:list")
    public AjaxResult get(@RequestParam(required = false) Long tenantId,
                          @RequestParam(required = false) Long stationId,
                          @RequestParam(required = false) String startDate,
                          @RequestParam(required = false) String endDate)
    {
        return AjaxResult.success(dashboardService.getOverview(tenantId, stationId, startDate, endDate));
    }
}
