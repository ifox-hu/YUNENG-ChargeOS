package com.hcp.common.mybatisplus.tenant;

import com.hcp.common.core.exception.ServiceException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TenantLifecycleTest {
    @Test void commonConfigurationRegistersLifecycleGuard() {
        try (org.springframework.context.annotation.AnnotationConfigApplicationContext context = new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            context.registerBean(JdbcTemplate.class, () -> jdbc);
            context.register(com.hcp.common.mybatisplus.config.MybatisPlusConfig.class);
            context.refresh();
            assertNotNull(context.getBean(TenantLifecycle.class));
        }
    }
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    @Test void rejectsMissingTenantUnlessExplicitDemoSwitch() {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(Collections.emptyList());
        assertThrows(ServiceException.class, () -> new TenantLifecycle(jdbc,false).requireActive(71001L));
        assertThrows(ServiceException.class, () -> new TenantLifecycle(jdbc,false).requireActive(9999L));
        assertDoesNotThrow(() -> new TenantLifecycle(jdbc,true).requireActive(9999L));
        assertThrows(ServiceException.class, () -> new TenantLifecycle(jdbc,true).requireActive(71001L));
    }
    @Test void rejectsDisabledExpiredAndDeletedEvenDemoTenant() {
        Map<String,Object> row = new HashMap<>();
        row.put("status",1); row.put("del_flag","0"); row.put("unexpired",1);
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(Collections.singletonList(row));
        TenantLifecycle service = new TenantLifecycle(jdbc,true);
        assertThrows(ServiceException.class, () -> service.requireActive(9999L));
        row.put("status",0); row.put("unexpired",0);
        assertThrows(ServiceException.class, () -> service.requireActive(71001L));
        row.put("unexpired",1); row.put("del_flag","1");
        assertThrows(ServiceException.class, () -> service.requireActive(71001L));
        row.put("del_flag","0");
        assertDoesNotThrow(() -> service.requireActive(71001L));
    }
}
