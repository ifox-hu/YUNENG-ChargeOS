package com.hcp.operator.charging;

import com.hcp.system.api.domain.ChargingOrder;

public interface ChargingDeviceStrategy {
    Long deviceType();
    void prepare(String pileId);
    void start(ChargingOrder order);
    void stop(String pileId, String devicePort);
}
