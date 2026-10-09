package com.hcp.simulator.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hcp.common.core.exception.base.BaseException;
import com.hcp.simulator.mapper.ChargingOrderMapper;
import com.hcp.simulator.service.ChargingOrderService;
import com.hcp.system.api.domain.ChargingOrder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Date;

@Service
public class ChargingOrderServiceImpl extends ServiceImpl<ChargingOrderMapper, ChargingOrder> implements ChargingOrderService {
    @Override
    @Transactional
    public void updateNoEndOrder(String pileId) {
        if (count(Wrappers.<ChargingOrder>lambdaQuery().eq(ChargingOrder::getPileId, pileId)
                .in(ChargingOrder::getChargeStatus, "9001", "9002")
                .and(q -> q.notLikeRight(ChargingOrder::getOrderNumber, "TEST")
                        .or().isNull(ChargingOrder::getOrderNumber))) > 0) {
            throw new BaseException("存在未结束的普通订单，无法启动模拟桩");
        }
        // Reset only simulator orders; payment and settlement remain owned by the operator service.
        update(Wrappers.<ChargingOrder>lambdaUpdate().eq(ChargingOrder::getPileId, pileId)
                .likeRight(ChargingOrder::getOrderNumber, "TEST")
                .in(ChargingOrder::getChargeStatus, "9001", "9002")
                .set(ChargingOrder::getChargeStatus, "9003").set(ChargingOrder::getOrderState, "2")
                .set(ChargingOrder::getRealEndTime, new Date())
                .set(ChargingOrder::getStopReason, "模拟桩重启取消测试订单"));
    }
}
