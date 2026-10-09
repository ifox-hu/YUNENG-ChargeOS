package com.hcp.mp.controller;

import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.redis.service.RedisService;
import com.hcp.mp.constant.MpConstant;
import com.hcp.system.api.RemoteFaultService;
import com.hcp.system.api.domain.FaultRequest;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.Map;

@RestController
@RequestMapping("/fault")
public class FaultReportController {
    @Resource private RedisService redis;
    @Resource private RemoteFaultService faults;

    private Long member(String token) {
        Object id = token == null ? null : redis.getCacheObject(
            MpConstant.USER_TOKEN + token.replaceFirst("^Bearer ", ""));
        if (id == null) throw new ServiceException("登录已失效，请重新登录",401);
        return Long.valueOf(String.valueOf(id));
    }
    private R<Map<String,Object>> checked(R<Map<String,Object>> result) {
        return result == null ? R.fail("工单服务暂不可用，请稍后重试") : result;
    }
    @PostMapping("/report")
    public R<Map<String,Object>> report(@RequestHeader(value="token",required=false) String token,
                                       @RequestBody FaultRequest request) {
        return checked(faults.report(request,member(token),SecurityConstants.INNER));
    }
    @GetMapping("/mine")
    public R<Map<String,Object>> mine(@RequestHeader(value="token",required=false) String token,
        @RequestParam(defaultValue="1") int pageNum, @RequestParam(defaultValue="10") int pageSize) {
        return checked(faults.mine(member(token),pageNum,pageSize,SecurityConstants.INNER));
    }
    @GetMapping("/{id}")
    public R<Map<String,Object>> detail(@RequestHeader(value="token",required=false) String token,
                                       @PathVariable Long id) {
        return checked(faults.detail(id,member(token),SecurityConstants.INNER));
    }
    @PostMapping("/{id}/confirm")
    public R<Map<String,Object>> confirm(@RequestHeader(value="token",required=false) String token,
                                       @PathVariable Long id) {
        return checked(faults.confirm(id,member(token),SecurityConstants.INNER));
    }
}

