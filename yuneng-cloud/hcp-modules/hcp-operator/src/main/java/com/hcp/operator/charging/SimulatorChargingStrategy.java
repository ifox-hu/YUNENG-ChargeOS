package com.hcp.operator.charging;

import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.system.api.RemoteSimulatorService;
import com.hcp.system.api.domain.ChargingOrder;
import org.springframework.stereotype.Component;

@Component
public class SimulatorChargingStrategy implements ChargingDeviceStrategy {
    private final RemoteSimulatorService simulator;
    public SimulatorChargingStrategy(RemoteSimulatorService simulator) { this.simulator = simulator; }
    public Long deviceType() { return 4L; }

    public void prepare(String pileId) {
        R<String> boot = simulator.start(pileId);
        if (boot == null || (boot.getCode() != 200 && !String.valueOf(boot.getMsg()).contains("已启动"))) {
            throw new ServiceException("模拟桩启动失败");
        }
    }

    public void start(ChargingOrder order) {
        requireSuccess(simulator.link(order.getPileId(), order.getDeviceId()), "模拟插枪失败");
        requireSuccess(simulator.startCharge(order), "模拟充电启动失败");
    }

    public void stop(String pileId, String devicePort) {
        requireSuccess(simulator.stopCharge(pileId, devicePort), "模拟停止充电失败");
    }

    private static void requireSuccess(R<?> result, String message) {
        if (result == null || result.getCode() != 200) throw new ServiceException(message);
    }
}
