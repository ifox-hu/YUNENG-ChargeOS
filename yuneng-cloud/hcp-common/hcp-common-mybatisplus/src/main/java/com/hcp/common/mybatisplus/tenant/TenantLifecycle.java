package com.hcp.common.mybatisplus.tenant;

import com.hcp.common.core.exception.ServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.*;

/** Only new business entry points use this guard; settlement and safe stop remain available. */
@Component
public class TenantLifecycle {
    private final JdbcTemplate jdbc;
    private final boolean demoEnabled;
    public TenantLifecycle(JdbcTemplate jdbc, @Value("${hcp.demo-tenant.enabled:false}") boolean demoEnabled) {
        this.jdbc = jdbc; this.demoEnabled = demoEnabled;
    }
    public boolean isDemoEnabled() { return demoEnabled; }
    public void requireActive(Long tenantId) {
        if (tenantId == null || tenantId <= 0) throw new ServiceException("运营商编码无效");
        List<Map<String,Object>> rows = jdbc.queryForList(
            "SELECT status,del_flag,(tenant_time > CURRENT_TIMESTAMP) AS unexpired FROM sys_tenant WHERE id=?", tenantId);
        if (rows.isEmpty()) {
            if (demoEnabled && tenantId == 9999L) return;
            throw new ServiceException("运营商不存在");
        }
        Map<String,Object> row = rows.get(0);
        Object unexpired = row.get("unexpired");
        if (!"0".equals(String.valueOf(row.get("status"))) || !"0".equals(String.valueOf(row.get("del_flag")))
                || !(unexpired instanceof Number) || ((Number)unexpired).intValue() != 1) {
            throw new ServiceException("运营商已停用或到期");
        }
    }
    public void initializeChargingRule(Long tenantId) {
        jdbc.update("INSERT INTO c_operator_charge_rule(tenant_id,max_charging_hours,whitelist_enabled,version) VALUES(?,24,0,0)",tenantId);
    }
}
