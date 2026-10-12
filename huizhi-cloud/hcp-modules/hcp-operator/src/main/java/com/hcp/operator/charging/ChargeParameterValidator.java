package com.hcp.operator.charging;

import com.hcp.common.core.exception.ServiceException;
import org.springframework.stereotype.Component;

@Component
public class ChargeParameterValidator implements ChargeStartValidator {
    public int order() { return 10; }

    public void validate(ChargeStartContext context) {
        if (context.memberId == null || context.memberId <= 0 || context.hours == null
                || context.hours < 1 || context.hours > 24 || context.amount == null || context.amount.signum() < 0) {
            throw new ServiceException("充电用户、时长或金额无效");
        }
    }
}
