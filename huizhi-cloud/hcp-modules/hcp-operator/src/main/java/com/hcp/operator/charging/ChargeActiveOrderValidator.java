package com.hcp.operator.charging;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.mapper.ChargingOrderMapper;
import org.springframework.stereotype.Component;

@Component
public class ChargeActiveOrderValidator implements ChargeStartValidator {
    private final ChargingOrderMapper orders;
    public ChargeActiveOrderValidator(ChargingOrderMapper orders) { this.orders = orders; }
    public int order() { return 40; }

    public void validate(ChargeStartContext context) {
        if (orders.countActiveByPort(context.port.getPortId()) > 0) {
            throw new ServiceException("该端口已有未结束订单，请勿重复启动");
        }
    }
}
