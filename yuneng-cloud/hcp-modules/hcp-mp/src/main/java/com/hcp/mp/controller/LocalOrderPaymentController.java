package com.hcp.mp.controller;

import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.redis.service.RedisService;
import com.hcp.mp.constant.MpConstant;
import com.hcp.system.api.RemoteLocalOperationsService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/local/orders")
public class LocalOrderPaymentController
{
    private final RedisService redis;
    private final RemoteLocalOperationsService operations;

    public LocalOrderPaymentController(RedisService redis, RemoteLocalOperationsService operations)
    {
        this.redis = redis; this.operations = operations;
    }

    private Long member(String token)
    {
        Object id = token == null ? null : redis.getCacheObject(MpConstant.USER_TOKEN + token.replaceFirst("^Bearer ", ""));
        if (id == null) throw new ServiceException("请先登录", 401);
        return Long.valueOf(String.valueOf(id));
    }

    @GetMapping("/{orderId}")
    public R<Map<String, Object>> detail(@PathVariable String orderId, @RequestHeader(value="token", required=false) String token)
    {
        return operations.detail(orderId, member(token), SecurityConstants.INNER);
    }

    @PostMapping("/pay")
    public R<Map<String, Object>> pay(@RequestBody Map<String, Object> request, @RequestHeader(value="token", required=false) String token)
    {
        return operations.pay(request, member(token), SecurityConstants.INNER);
    }
}
