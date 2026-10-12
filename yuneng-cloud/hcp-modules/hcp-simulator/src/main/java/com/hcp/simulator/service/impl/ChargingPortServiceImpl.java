package com.hcp.simulator.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hcp.simulator.mapper.ChargingPortMapper;
import com.hcp.simulator.service.ChargingPortService;
import com.hcp.system.api.domain.ChargingPort;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ChargingPortServiceImpl extends ServiceImpl<ChargingPortMapper, ChargingPort> implements ChargingPortService {
    @Override
    public List<ChargingPort> getByDeviceId(String pileId) {
        return list(Wrappers.<ChargingPort>lambdaQuery().eq(ChargingPort::getPileId, pileId));
    }

    @Override
    public void updateGunStatus(String pileId, String deviceId, Long gunStatus, String state) {
        update(Wrappers.<ChargingPort>lambdaUpdate().eq(ChargingPort::getPileId, pileId)
                .eq(ChargingPort::getDeviceId, deviceId).set(ChargingPort::getGunStatus, gunStatus)
                .set(ChargingPort::getState, state));
    }
}
