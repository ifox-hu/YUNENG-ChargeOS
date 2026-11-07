package com.hcp.mp.service;

import com.hcp.common.mybatisplus.tenant.TenantLifecycle;
import com.hcp.common.redis.service.RedisService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountTenantRegistrationTest {
    @Test void explicitTenantIsWrittenToMemberAndWallet() {
        AccountLoginService service = new AccountLoginService();
        List<Long> writtenTenants = new ArrayList<>();
        JdbcTemplate jdbc = new JdbcTemplate() {
            @Override public <T> T queryForObject(String sql, Class<T> type, Object... args) {
                return type.cast(type == Integer.class ? (Object)Integer.valueOf(0) : Long.valueOf(501));
            }
            @Override public int update(String sql, Object... args) {
                if (sql.startsWith("INSERT INTO c_member(")) writtenTenants.add(((Number)args[3]).longValue());
                if (sql.startsWith("INSERT INTO c_menber_balance(")) writtenTenants.add(((Number)args[1]).longValue());
                return 1;
            }
        };
        RedisService redis = mock(RedisService.class);
        when(redis.getCacheObject("app:register-code:13800000001")).thenReturn("123456");
        ReflectionTestUtils.setField(service,"jdbc",jdbc);
        ReflectionTestUtils.setField(service,"redis",redis);
        ReflectionTestUtils.setField(service,"localTest",true);
        ReflectionTestUtils.setField(service,"lifecycle",mock(TenantLifecycle.class));
        assertEquals(200,service.register("tenant_test","TestOnly123!","13800000001","123456",71001L).getCode());
        assertEquals(Arrays.asList(71001L,71001L),writtenTenants);
    }
}
