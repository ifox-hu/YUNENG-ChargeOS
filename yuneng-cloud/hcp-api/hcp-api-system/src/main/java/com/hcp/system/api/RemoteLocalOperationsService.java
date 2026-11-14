package com.hcp.system.api;

import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.common.core.constant.ServiceNameConstants;
import com.hcp.common.core.domain.R;
import java.util.Map;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

/** 小程序本地付款入口，仅供可信内部服务调用。 */
@FeignClient(contextId = "remoteLocalOperationsService", value = ServiceNameConstants.OPERATOR_SERVICE)
public interface RemoteLocalOperationsService
{
    @GetMapping("/operations/internal/order/{orderId}")
    R<Map<String, Object>> detail(@PathVariable("orderId") String orderId, @RequestParam("memberId") Long memberId,
        @RequestHeader(SecurityConstants.FROM_SOURCE) String source);

    @PostMapping("/operations/internal/pay")
    R<Map<String, Object>> pay(@RequestBody Map<String, Object> request, @RequestParam("memberId") Long memberId,
        @RequestHeader(SecurityConstants.FROM_SOURCE) String source);
}
