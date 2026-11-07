package com.hcp.operator.charging;

import com.hcp.operator.rule.OperatorChargeRuleService;
import org.springframework.stereotype.Component;

@Component
public class OperatorChargeRuleValidator implements ChargeStartValidator {
    private final OperatorChargeRuleService rules;
    public OperatorChargeRuleValidator(OperatorChargeRuleService rules) { this.rules = rules; }
    public int order() { return 50; }
    public void validate(ChargeStartContext context) {
        rules.validateStart(context.port.getTenantId(),context.memberId,context.hours);
    }
}
