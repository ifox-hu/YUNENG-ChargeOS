package com.hcp.common.security.interceptor;

import com.hcp.common.core.constant.SecurityConstants;
import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.utils.SpringUtils;
import com.hcp.common.security.service.TokenService;
import com.hcp.system.api.domain.SysUser;
import com.hcp.system.api.model.LoginUser;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.mock.web.*;
import org.springframework.web.context.request.*;
import org.springframework.web.method.HandlerMethod;
import static org.junit.jupiter.api.Assertions.*;

class HeaderInterceptorTest {
    private HeaderInterceptor interceptor = new HeaderInterceptor();
    private MockHttpServletRequest request;
    private MockHttpServletResponse response = new MockHttpServletResponse();
    private HandlerMethod handler;

    @BeforeAll static void sessionStore() {
        DefaultListableBeanFactory beans = new DefaultListableBeanFactory();
        beans.registerSingleton("tokenService", new TokenService() {
            @Override public LoginUser getLoginUser(String token) {
                if (!"valid-session".equals(token)) return null;
                SysUser user = new SysUser();
                user.setUserId(42L); user.setUserName("operator-a");
                user.setTenantId(71001L); user.setDeptId(81L);
                LoginUser login = new LoginUser(); login.setSysUser(user); login.setToken("server-key");
                return login;
            }
            @Override public void verifyToken(LoginUser user) { }
        });
        new SpringUtils().postProcessBeanFactory(beans);
    }
    @BeforeEach void setup() throws Exception {
        request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer valid-session");
        request.addHeader(SecurityConstants.DETAILS_TENANT_ID, "71002");
        request.addHeader(SecurityConstants.DETAILS_USER_ID, "1");
        request.addHeader(SecurityConstants.DETAILS_USERNAME, "forged-root");
        request.addHeader(SecurityConstants.DETAILS_DEPT_ID, "999");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        handler = new HandlerMethod(this, getClass().getDeclaredMethod("endpoint"));
    }
    void endpoint() { }
    @AfterEach void cleanup() { SecurityContextHolder.remove(); RequestContextHolder.resetRequestAttributes(); }
    @Test void sessionOverridesForgedTenantAndRootHeaders() throws Exception {
        interceptor.preHandle(request, response, handler);
        assertEquals(71001L, SecurityContextHolder.getTenantId());
        assertEquals(42L, SecurityContextHolder.getUserId());
        assertEquals("operator-a", SecurityContextHolder.getUserName());
        assertEquals(81L, SecurityContextHolder.getDeptId());
        assertEquals("server-key", SecurityContextHolder.getUserKey());
    }
    @Test void requestCompletionClearsIdentity() throws Exception {
        interceptor.preHandle(request, response, handler);
        interceptor.afterCompletion(request, response, handler, null);
        assertEquals(0L, SecurityContextHolder.getUserId());
        assertNull(SecurityContextHolder.get(SecurityConstants.LOGIN_USER, LoginUser.class));
    }
}
