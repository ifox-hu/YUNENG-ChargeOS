package com.hcp.mp.controller;

import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.redis.service.RedisService;
import com.hcp.mp.constant.MpConstant;
import com.hcp.mp.service.WalletPointsService;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping
public class WalletPointsController
{
    private final RedisService redis;
    private final WalletPointsService walletPointsService;

    public WalletPointsController(RedisService redisService, WalletPointsService pointsService)
    {
        redis = redisService;
        walletPointsService = pointsService;
    }

    private long member(String token)
    {
        Object id =
            token == null ? null : redis.getCacheObject(MpConstant.USER_TOKEN + token.replaceFirst("^Bearer ", ""));
        if (id == null)
            throw new ServiceException("登录已失效，请重新登录", 401);
        return Long.parseLong(String.valueOf(id));
    }

    @GetMapping("/wallet/summary")
    public R<Map<String, Object>> wallet(@RequestHeader(value = "token", required = false) String token)
    {
        return R.ok(walletPointsService.wallet(member(token)));
    }

    @GetMapping("/wallet/ledger")
    public R<?> walletLedger(@RequestHeader(value = "token", required = false) String token,
                             @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size)
    {
        return R.ok(walletPointsService.walletLedger(member(token), page, size));
    }

    @PostMapping("/wallet/recharge")
    public R<Map<String, Object>> recharge(@RequestHeader(value = "token", required = false) String token,
                                           @RequestBody Map<String, Object> request)
    {
        Object amount = request.get("amount"), requestId = request.get("requestId");
        return R.ok(walletPointsService.recharge(member(token), amount == null ? null : new BigDecimal(String.valueOf(amount)),
                                 requestId == null ? null : String.valueOf(requestId)));
    }

    @GetMapping("/points/summary")
    public R<Map<String, Object>> points(@RequestHeader(value = "token", required = false) String token)
    {
        return R.ok(walletPointsService.points(member(token)));
    }

    @GetMapping("/points/ledger")
    public R<?> pointsLedger(@RequestHeader(value = "token", required = false) String token,
                             @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size)
    {
        return R.ok(walletPointsService.pointsLedger(member(token), page, size));
    }

    @PostMapping("/points/sign")
    public R<Map<String, Object>> sign(@RequestHeader(value = "token", required = false) String token)
    {
        return R.ok(walletPointsService.sign(member(token)));
    }

    @GetMapping("/points/orders")
    public R<?> orders(@RequestHeader(value = "token", required = false) String token)
    {
        return R.ok(walletPointsService.eligibleOrders(member(token)));
    }

    @PostMapping("/points/orders/{id}/claim")
    public R<Map<String, Object>> claim(@RequestHeader(value = "token", required = false) String token,
                                        @PathVariable String id)
    {
        return R.ok(walletPointsService.claimOrder(member(token), id));
    }
}
