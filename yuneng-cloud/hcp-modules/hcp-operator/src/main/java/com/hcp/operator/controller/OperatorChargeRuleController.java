package com.hcp.operator.controller;

import com.hcp.common.core.web.domain.AjaxResult;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.operator.rule.OperatorChargeRuleService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/chargeRule")
public class OperatorChargeRuleController {
    private final OperatorChargeRuleService rules;
    public OperatorChargeRuleController(OperatorChargeRuleService rules) { this.rules = rules; }
    public static class Update {
        public Long targetTenantId;
        public Integer maxChargingHours;
        public Boolean whitelistEnabled;
        public Long version;
        public Long memberId;
    }
    @GetMapping @RequiresPermissions("operator:chargeRule:query")
    public AjaxResult get(@RequestParam(required=false) Long targetTenantId) { return AjaxResult.success(rules.get(targetTenantId)); }
    @PutMapping @RequiresPermissions("operator:chargeRule:edit")
    public AjaxResult update(@RequestBody Update body) {
        rules.update(body.targetTenantId,body.maxChargingHours,body.whitelistEnabled,body.version);
        return AjaxResult.success();
    }
    @PostMapping("/member") @RequiresPermissions("operator:chargeRule:edit")
    public AjaxResult add(@RequestBody Update body) {
        rules.changeMember(body.targetTenantId,body.memberId,true,body.version); return AjaxResult.success();
    }
    @DeleteMapping("/member") @RequiresPermissions("operator:chargeRule:edit")
    public AjaxResult remove(@RequestBody Update body) {
        rules.changeMember(body.targetTenantId,body.memberId,false,body.version); return AjaxResult.success();
    }
}
