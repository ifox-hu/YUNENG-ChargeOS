package com.hcp.gateway.filter;

import com.hcp.common.core.constant.*;
import com.hcp.common.core.utils.JwtUtils;
import com.hcp.common.redis.service.RedisService;
import com.hcp.gateway.config.properties.IgnoreWhiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthFilterTest {
    @Test void gatewayUsesSessionIdentityInsteadOfCallerHeaders() {
        Map<String,Object> claims = new HashMap<>();
        claims.put(SecurityConstants.USER_KEY,"test-key");
        claims.put(SecurityConstants.DETAILS_USER_ID,42L);
        claims.put(SecurityConstants.DETAILS_USERNAME,"operator-a");
        claims.put(SecurityConstants.DETAILS_DEPT_ID,81L);
        String token = JwtUtils.createToken(claims);
        // Cache uses Fastjson metadata; gateway intentionally does not depend on servlet API models.
        Map<String,Object> user = new HashMap<>();
        user.put("userId",42L); user.put("userName","operator-a"); user.put("deptId",81L); user.put("tenantId",71001L);
        Map<String,Object> session = new HashMap<>(); session.put("sysUser",user);
        RedisService redis = mock(RedisService.class);
        when(redis.hasKey(CacheConstants.LOGIN_TOKEN_KEY+"test-key")).thenReturn(true);
        when(redis.getCacheObject(CacheConstants.LOGIN_TOKEN_KEY+"test-key")).thenReturn(session);
        IgnoreWhiteProperties whites = new IgnoreWhiteProperties(); whites.setWhites(Collections.emptyList());
        AuthFilter filter = new AuthFilter();
        ReflectionTestUtils.setField(filter,"redisService",redis);
        ReflectionTestUtils.setField(filter,"ignoreWhite",whites);
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/system/user/getInfo")
            .header("Authorization","Bearer "+token)
            .header(SecurityConstants.DETAILS_TENANT_ID,"71002")
            .header(SecurityConstants.DETAILS_USER_ID,"1")
            .header(SecurityConstants.FROM_SOURCE,"inner"));
        AtomicReference<ServerWebExchange> forwarded = new AtomicReference<>();
        filter.filter(exchange, e -> {forwarded.set(e); return Mono.empty();}).block();
        assertNotNull(forwarded.get());
        assertEquals("71001",forwarded.get().getRequest().getHeaders().getFirst(SecurityConstants.DETAILS_TENANT_ID));
        assertEquals("42",forwarded.get().getRequest().getHeaders().getFirst(SecurityConstants.DETAILS_USER_ID));
        assertNull(forwarded.get().getRequest().getHeaders().getFirst(SecurityConstants.FROM_SOURCE));
    }
}
