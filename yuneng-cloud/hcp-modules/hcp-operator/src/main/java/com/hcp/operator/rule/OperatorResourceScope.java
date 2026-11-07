package com.hcp.operator.rule;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.exception.ServiceException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class OperatorResourceScope {
    private final JdbcTemplate jdbc;
    public OperatorResourceScope(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Long bind(Long suppliedTenant) {
        Long tenant = SecurityContextHolder.getTenantId();
        if (SecurityContextHolder.getUserId() <= 0 || (suppliedTenant != null && !tenant.equals(suppliedTenant)))
            throw new ServiceException("资源租户归属不匹配");
        return tenant;
    }
    public void station(Long station, Long tenant) {
        if (station == null || jdbc.queryForList("SELECT station_id FROM c_charging_station WHERE station_id=? AND tenant_id=?",station,tenant).isEmpty())
            throw new ServiceException("站点不存在或不属于本运营商");
    }
    public void pile(String pile, Long tenant) {
        if (pile == null || jdbc.queryForList("SELECT pile_id FROM c_charging_pile WHERE pile_id=? AND tenant_id=?",pile,tenant).isEmpty())
            throw new ServiceException("充电桩不存在或不属于本运营商");
    }
    public void port(Long port, Long tenant) {
        if (port == null || jdbc.queryForList("SELECT port_id FROM c_charging_port WHERE port_id=? AND tenant_id=?",port,tenant).isEmpty())
            throw new ServiceException("端口不存在或不属于本运营商");
    }
    public void member(Long member, Long tenant) {
        if (member == null || jdbc.queryForList("SELECT member_id FROM c_member WHERE member_id=? AND tenant_id=?",member,tenant).isEmpty())
            throw new ServiceException("会员不存在或不属于本运营商");
    }
}
