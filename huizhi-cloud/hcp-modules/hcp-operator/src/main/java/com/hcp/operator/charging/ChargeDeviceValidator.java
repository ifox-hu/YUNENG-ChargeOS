package com.hcp.operator.charging;

import com.hcp.common.core.exception.ServiceException;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class ChargeDeviceValidator implements ChargeStartValidator {
    public int order() { return 30; }

    public void validate(ChargeStartContext context) {
        if (context.pile == null || Integer.valueOf(1).equals(context.pile.getDeleted())) {
            throw new ServiceException("充电桩不存在或已删除");
        }
        if (context.port == null || !Objects.equals(context.pile.getPileId(), context.port.getPileId())
                || !Objects.equals(context.pile.getTenantId(), context.port.getTenantId())) {
            throw new ServiceException("充电桩与端口信息不匹配");
        }
        if (!"N".equals(context.port.getState()) || Long.valueOf(1).equals(context.port.getCanUse())
                || (context.port.getGunStatus() != null && context.port.getGunStatus() != 0L)) {
            throw new ServiceException("端口忙碌、故障或不可用，请重新选择");
        }
        // Local simulator strategy boots an offline simulator before inserting the gun.
        if (!Long.valueOf(4).equals(context.pile.getDeviceType())
                && !Long.valueOf(0).equals(context.pile.getRunningStatus())) {
            throw new ServiceException("充电设备离线");
        }
    }
}
