package com.hcp.operator.charging;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.mybatisplus.tenant.TenantLifecycle;
import com.hcp.operator.rule.OperatorChargeRuleService;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OperatorChargeRuleTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final Map<String,Object> rule = new HashMap<>();
    private final OperatorChargeRuleService service = new OperatorChargeRuleService(jdbc,mock(TenantLifecycle.class));
    @BeforeEach void setup() {
        rule.put("max_charging_hours",2); rule.put("whitelist_enabled",1); rule.put("version",3L);
        when(jdbc.queryForList(contains("c_operator_charge_rule"),anyLong())).thenReturn(Collections.singletonList(rule));
        when(jdbc.queryForList(contains("c_operator_charge_whitelist"),anyLong(),anyLong())).thenReturn(Collections.emptyList());
        SecurityContextHolder.setUserId("42"); SecurityContextHolder.setTenantId("71001");
    }
    @AfterEach void clear() { SecurityContextHolder.remove(); }
    @Test void enabledEmptyWhitelistDeniesStart() {
        assertThrows(ServiceException.class, () -> service.validateStart(71001L,501L,1));
    }
    @Test void durationCannotExceedTenantLimit() {
        rule.put("whitelist_enabled",0);
        assertThrows(ServiceException.class, () -> service.validateStart(71001L,501L,3));
        assertDoesNotThrow(() -> service.validateStart(71001L,501L,2));
    }
    @Test void foreignTargetCannotSwitchLoggedInTenant() {
        assertThrows(ServiceException.class, () -> service.authorizeTenant(71002L));
        assertEquals(71001L,service.authorizeTenant(null));
    }
    @Test void missingRuleFailsClosed() {
        when(jdbc.queryForList(contains("c_operator_charge_rule"),anyLong())).thenReturn(Collections.emptyList());
        assertThrows(ServiceException.class, () -> service.validateStart(71001L,501L,1));
    }
    @Test void whitelistRejectsForeignMemberBeforeMutation() {
        when(jdbc.queryForList(contains("c_member"),anyLong(),anyLong())).thenReturn(Collections.emptyList());
        assertThrows(ServiceException.class, () -> service.changeMember(null,502L,true,3L));
    }
}
