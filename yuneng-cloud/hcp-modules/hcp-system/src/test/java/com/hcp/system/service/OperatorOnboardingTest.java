package com.hcp.system.service;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.system.domain.*;
import com.hcp.system.mapper.*;
import com.hcp.system.service.impl.SysTenantServiceImpl;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OperatorOnboardingTest {
    private final SysTenantServiceImpl service = new SysTenantServiceImpl();
    private final SysTenantMapper tenants = mock(SysTenantMapper.class);
    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service,"sysTenantMapper",tenants);
        ReflectionTestUtils.setField(service,"userMapper",mock(SysUserMapper.class));
        ReflectionTestUtils.setField(service,"sysTenantPackageMapper",mock(SysTenantPackageMapper.class));
    }
    @AfterEach void clear() { SecurityContextHolder.remove(); }
    @Test void nonRootCannotUseLegacyTenantCreationEvenWithTenant9999() {
        SecurityContextHolder.setUserId("42"); SecurityContextHolder.setTenantId("9999");
        assertThrows(ServiceException.class, () -> service.insertSysTenant(new SysTenant()));
    }
    @Test void explicitOnboardingRejectsNonRootBeforeDatabaseWork() {
        SecurityContextHolder.setUserId("42");
        assertThrows(ServiceException.class, () -> service.onboard(new SysTenant(),"TestOnly123!"));
    }
    @Test void rootMustProvideValidInitialPasswordAndTenantCode() {
        SecurityContextHolder.setUserId("1");
        SysTenant tenant = new SysTenant(); tenant.setId(9999L);
        assertThrows(ServiceException.class, () -> service.onboard(tenant,"TestOnly123!"));
        tenant.setId(71001L);
        assertThrows(ServiceException.class, () -> service.onboard(tenant,"short"));
    }
    @Test void initialPasswordMustFitExistingLoginLengthLimit() {
        SecurityContextHolder.setUserId("1");
        SysTenant tenant = new SysTenant(); tenant.setId(71001L); tenant.setTenantName("验证运营商");
        tenant.setUserName("valid_admin"); tenant.setTenantTime(new java.util.Date(System.currentTimeMillis()+86400000));
        ServiceException error=assertThrows(ServiceException.class, () -> service.onboard(tenant,"LongPassword1234567890123"));
        assertTrue(error.getMessage().contains("初始密码"));
    }
}
