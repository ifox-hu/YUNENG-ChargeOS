package com.hcp.operator.charging;

import com.hcp.common.core.exception.ServiceException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ChargingDeviceStrategies {
    private final Map<Long, ChargingDeviceStrategy> strategies = new HashMap<>();

    public ChargingDeviceStrategies(List<ChargingDeviceStrategy> implementations) {
        for (ChargingDeviceStrategy strategy : implementations) {
            if (strategies.put(strategy.deviceType(), strategy) != null) {
                throw new IllegalStateException("Duplicate device strategy: " + strategy.deviceType());
            }
        }
    }

    public ChargingDeviceStrategy require(Long deviceType) {
        ChargingDeviceStrategy strategy = strategies.get(deviceType);
        if (strategy == null) throw new ServiceException("该设备类型尚未接入充电策略");
        return strategy;
    }
}
