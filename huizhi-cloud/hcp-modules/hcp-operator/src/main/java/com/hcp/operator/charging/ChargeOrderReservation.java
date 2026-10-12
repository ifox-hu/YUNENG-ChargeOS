package com.hcp.operator.charging;

import com.hcp.operator.constant.ChargeStatus;
import com.hcp.operator.constant.FeeConstant;
import com.hcp.operator.constant.OrderState;
import com.hcp.operator.mapper.ChargingOrderMapper;
import com.hcp.operator.mapper.ChargingPileMapper;
import com.hcp.operator.mapper.ChargingPortMapper;
import com.hcp.operator.mapper.OrderLogMapper;
import com.hcp.operator.utils.RandomUtil;
import com.hcp.system.api.domain.ChargingOrder;
import com.hcp.system.api.domain.ChargingPile;
import com.hcp.system.api.domain.ChargingPort;
import com.hcp.system.api.domain.OrderLog;
import cn.hutool.core.date.DateUtil;
import java.math.BigDecimal;
import java.util.Date;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChargeOrderReservation {
    private final ChargingPortMapper ports;
    private final ChargingPileMapper piles;
    private final ChargingOrderMapper orders;
    private final OrderLogMapper logs;
    private final ChargeStartValidationChain validation;

    public ChargeOrderReservation(ChargingPortMapper ports, ChargingPileMapper piles, ChargingOrderMapper orders,
                                 OrderLogMapper logs, ChargeStartValidationChain validation) {
        this.ports = ports;
        this.piles = piles;
        this.orders = orders;
        this.logs = logs;
        this.validation = validation;
    }

    // Commit the order reservation before any device RPC touches the port row.
    @Transactional(rollbackFor = Exception.class, isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ChargingOrder reserve(String pileId, String devicePort, Long memberId, BigDecimal amount, Integer hours) {
        ChargingPort port = ports.lockPort(pileId, devicePort);
        ChargingPile pile = piles.getById(pileId);
        validation.validate(new ChargeStartContext(pile, port, memberId, amount, hours));
        ChargingOrder order = new ChargingOrder();
        String number = RandomUtil.getRandomNumber(32);
        order.setOrderId(number);
        order.setOrderNumber(number);
        order.setUserId(memberId);
        order.setPileId(pileId);
        order.setPortId(port.getPortId());
        order.setDeviceId(devicePort);
        order.setDeviceType(pile.getDeviceType());
        order.setOrderState(OrderState.PLACE);
        order.setChargeStatus(ChargeStatus.PRE_CHARGE);
        order.setStartTime(DateUtil.formatDateTime(new Date()));
        order.setIsFee(FeeConstant.FREE_FEE);
        order.setHour(String.valueOf(hours));
        order.setTenantId(port.getTenantId());
        orders.insertOrder(order);
        OrderLog log = new OrderLog();
        log.setOrderNumber(number);
        log.setMainProcess(1L);
        log.setBriefInfo("客户下单");
        log.setLogContent("充电校验通过，订单已预占，等待设备启动");
        log.setTenantId(port.getTenantId());
        log.setCreateTime(new Date());
        logs.insertOrderLog(log);
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public void markUncertain(String orderId) {
        ChargingOrder order = orders.lockById(orderId);
        if (order != null && OrderState.PLACE.equals(order.getOrderState())
                && ChargeStatus.PRE_CHARGE.equals(order.getChargeStatus())) {
            order.setStopReason("设备启动结果待确认，请勿重复下单");
            orders.updateByPrimaryKeySelective(order);
        }
    }
}
