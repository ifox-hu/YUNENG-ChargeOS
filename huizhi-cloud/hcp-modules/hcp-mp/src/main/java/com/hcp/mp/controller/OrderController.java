package com.hcp.mp.controller;

import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.redis.service.RedisService;
import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.mp.constant.MpConstant;
import com.hcp.common.core.utils.ServletUtils;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.system.api.RemoteChargeOrderService;
import com.hcp.system.api.RemoteChargePortService;
import com.hcp.system.api.RemoteChargingService;
import com.hcp.system.api.domain.ChargingOrder;
import com.hcp.system.api.domain.ChargingPort;
import com.hcp.system.api.domain.OrderLog;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/order")
@Slf4j
public class OrderController {

    @Resource
    private RemoteChargingService remoteChargingService;

    @Resource
    private RemoteChargePortService remoteChargePortService;

    @Resource
    private RemoteChargeOrderService remoteChargeOrderService;

    @Resource
    private RedisService redisService;

    private ChargingOrder ownedOrder(String orderNumber) {
        String token = ServletUtils.getRequest().getHeader("token");
        Object member = token == null ? null : redisService.getCacheObject(
            MpConstant.USER_TOKEN + token.replaceFirst("^Bearer ", ""));
        if (member == null) throw new ServiceException("登录已失效，请重新登录");
        R<ChargingOrder> result = remoteChargeOrderService.getOrderByOrderNumber(orderNumber, SecurityConstants.INNER);
        if (result == null || result.getCode() != 200 || result.getData() == null) {
            throw new ServiceException("订单查询失败或订单不存在");
        }
        ChargingOrder order = result.getData();
        if (!String.valueOf(member).equals(String.valueOf(order.getUserId()))) {
            throw new ServiceException("无权查看或操作该订单");
        }
        return order;
    }


    @GetMapping("/saveOrder")
    public R<ChargingOrder> saveOrder(
            @RequestParam(value = "orderType", required = false) String orderType,
            @RequestParam("portId") Long portId,
            @RequestParam("amount") BigDecimal amount,
            @RequestParam("hour") Integer hour,
            @RequestParam("userId") Long userId
    ) {

//        Long userId = SecurityUtils.getUserId();
        R<ChargingPort> chargingPortR = remoteChargePortService.getChargePortByPortId(portId);
        if (ObjectUtil.isEmpty(chargingPortR) || ObjectUtil.isEmpty(chargingPortR.getData())) {
            throw new ServiceException("端口查询失败!");
        }
        ChargingPort chargingPort = chargingPortR.getData();

        R<ChargingOrder> result = remoteChargingService.startCharge(
            chargingPort.getPileId(), chargingPort.getDeviceId(), userId, amount, hour);
        if (result == null) return R.fail("启动服务无响应，请稍后重试");
        if (result.getCode() != R.SUCCESS) return result;
        ChargingOrder order = result.getData();
        if (order == null || order.getOrderNumber() == null || order.getPortId() == null
                || order.getPileId() == null) {
            return R.fail("启动结果缺少订单信息，请先检查订单列表");
        }
        return result;

    }

    @GetMapping("/queryOrderList")
    public R<Page<ChargingOrder>> queryOrderList(@RequestParam(value = "orderStatus", required = false) String orderStatus,
                                             @RequestParam(value = "pageNo") Integer pageNo,
                                             @RequestParam(value = "pageSize") Integer pageSize,
                                             @RequestParam("userId") Long userId) {
//        Long userId = SecurityUtils.getUserId();
        ChargingOrder chargingOrder = new ChargingOrder();
        chargingOrder.setOrderState(orderStatus);
        chargingOrder.setUserId(userId);
        chargingOrder.setPageNo(pageNo);
        chargingOrder.setPageSize(pageSize);
        R<Page<ChargingOrder>> orderList = remoteChargeOrderService.queryOrderList(chargingOrder);
        return orderList;
    }

    @GetMapping("/orderDetail")
    public R<ChargingOrder> orderDetail(
            @RequestParam("orderNumber") String orderNumber) {
        ChargingOrder chargingOrder = ownedOrder(orderNumber);
        return R.ok(chargingOrder);
    }

    @GetMapping("/orderTrace")
    public R<List<OrderLog>> orderTrace(
                                        @RequestParam("orderNumber") String orderNumber) {

        List<OrderLog> orderLogs = remoteChargeOrderService.queryOrderLogByOrderNumber(orderNumber).getData();
        return R.ok(orderLogs);
    }

    @GetMapping("/endCharge")
    public R<String> endCharge(@RequestParam("pileId") String pileId,
                               @RequestParam("port") String port,
                               @RequestParam(value = "orderNumber", required = false) String orderNumber) {

        if (orderNumber == null || orderNumber.isEmpty()) return R.fail("缺少订单编号，请重新进入订单");
        ChargingOrder order = ownedOrder(orderNumber);
        if (!pileId.equals(order.getPileId()) || !port.equals(String.valueOf(order.getPortId()))) {
            return R.fail("订单与端口信息不匹配");
        }
        if ("3".equals(order.getOrderState())) return R.ok();
        R<ChargingPort> chargePortByPortId = remoteChargePortService.getChargePortByPortId(Long.valueOf(port));
        if (ObjectUtil.isEmpty(chargePortByPortId) || chargePortByPortId.getData() == null) {
            return R.fail("充电口信息未找到");
        }
        String deviceId = chargePortByPortId.getData().getDeviceId();
        R<String> result = remoteChargingService.stopCharge(pileId, deviceId);
        return result == null ? R.fail("停止服务无响应") : result;
    }

}
