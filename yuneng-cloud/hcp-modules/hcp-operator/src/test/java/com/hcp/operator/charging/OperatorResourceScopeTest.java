package com.hcp.operator.charging;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.rule.OperatorResourceScope;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OperatorResourceScopeTest {
    @AfterEach void cleanup() { SecurityContextHolder.remove(); }
    @Test void rejectsForgedTenantAndForeignParent() {
        SecurityContextHolder.setUserId("42"); SecurityContextHolder.setTenantId("71001");
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(),anyLong(),anyLong())).thenReturn(Collections.emptyList());
        OperatorResourceScope scope = new OperatorResourceScope(jdbc);
        assertThrows(ServiceException.class, () -> scope.bind(71002L));
        assertEquals(71001L,scope.bind(null));
        assertThrows(ServiceException.class, () -> scope.station(82L,71001L));
    }
}
