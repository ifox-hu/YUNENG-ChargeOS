package com.hcp.system.api;

import com.hcp.common.core.constant.ServiceNameConstants;
import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.common.core.domain.R;
import com.hcp.system.api.domain.FaultRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@FeignClient(contextId="RemoteFaultService", value=ServiceNameConstants.OPERATOR_SERVICE)
public interface RemoteFaultService {
    @PostMapping("/fault/internal/report")
    R<Map<String,Object>> report(@RequestBody FaultRequest request, @RequestParam("memberId") Long memberId,
                                @RequestHeader(SecurityConstants.FROM_SOURCE) String source);
    @GetMapping("/fault/internal/mine")
    R<Map<String,Object>> mine(@RequestParam("memberId") Long memberId,
        @RequestParam("pageNum") int pageNum, @RequestParam("pageSize") int pageSize,
        @RequestHeader(SecurityConstants.FROM_SOURCE) String source);
    @GetMapping("/fault/internal/{id}")
    R<Map<String,Object>> detail(@PathVariable("id") Long id, @RequestParam("memberId") Long memberId,
        @RequestHeader(SecurityConstants.FROM_SOURCE) String source);
    @PostMapping("/fault/internal/{id}/confirm")
    R<Map<String,Object>> confirm(@PathVariable("id") Long id, @RequestParam("memberId") Long memberId,
        @RequestHeader(SecurityConstants.FROM_SOURCE) String source);
}

