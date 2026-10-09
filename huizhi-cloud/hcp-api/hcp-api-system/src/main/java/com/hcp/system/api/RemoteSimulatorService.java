package com.hcp.system.api;

import com.hcp.common.core.constant.ServiceNameConstants;
import com.hcp.common.core.domain.R;
import com.hcp.system.api.domain.ChargingOrder;
import com.hcp.system.api.factory.RemoteSimulatorFallbackFactory;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 模拟器服务
 *
 * @author vctgo
 */
@FeignClient(contextId = "remoteSimulatorService", value = ServiceNameConstants.SIMULATOR_SERVICE, fallbackFactory = RemoteSimulatorFallbackFactory.class)
public interface RemoteSimulatorService
{
    @GetMapping(value = "/evcs/sim/v1/start")
    R<String> start(@RequestParam("pileId") String pileId);

    // 模拟插枪，使端口进入可启动充电状态
    @GetMapping(value = "/evcs/sim/v1/link")
    R<String> link(@RequestParam("pileId") String pileId, @RequestParam("deviceId") String deviceId);

    //启动模拟器充电
    @PostMapping(value = "/evcs/sim/v1/startCharge")
    R<String> startCharge(@RequestBody ChargingOrder chargingOrder);

    //停止模拟器充电
    @GetMapping(value = "/evcs/sim/v1/endCharge")
    public R<String> stopCharge(@RequestParam("pileId")String pileId,@RequestParam("deviceId")String deviceId);
}
