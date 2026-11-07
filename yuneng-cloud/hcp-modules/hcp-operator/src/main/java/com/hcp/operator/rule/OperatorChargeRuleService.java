package com.hcp.operator.rule;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.mybatisplus.tenant.TenantLifecycle;
import com.hcp.common.security.utils.SecurityUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class OperatorChargeRuleService {
    private final JdbcTemplate jdbc;
    private final TenantLifecycle lifecycle;
    public OperatorChargeRuleService(JdbcTemplate jdbc, TenantLifecycle lifecycle) {
        this.jdbc = jdbc; this.lifecycle = lifecycle;
    }
    public Long authorizeTenant(Long target) {
        if (SecurityContextHolder.getUserId() <= 0) throw new ServiceException("请先登录后台账号");
        Long current = SecurityContextHolder.getTenantId();
        if (target != null && !target.equals(current) && !SecurityUtils.isAdmin(SecurityContextHolder.getUserId()))
            throw new ServiceException("无权访问其他运营商配置");
        Long tenant = target == null ? current : target;
        lifecycle.requireActive(tenant);
        return tenant;
    }
    private Map<String,Object> rule(Long tenant, String lock) {
        List<Map<String,Object>> rows = jdbc.queryForList("SELECT tenant_id,max_charging_hours,whitelist_enabled,version FROM c_operator_charge_rule WHERE tenant_id=?"+lock,tenant);
        if (rows.isEmpty()) throw new ServiceException("运营商充电配置未就绪");
        return rows.get(0);
    }
    /** Called in the existing reservation transaction after the port lock. */
    public void validateStart(Long tenant, Long member, Integer hours) {
        lifecycle.requireActive(tenant);
        Map<String,Object> row = rule(tenant," LOCK IN SHARE MODE");
        if (hours == null || hours > ((Number)row.get("max_charging_hours")).intValue())
            throw new ServiceException("充电时长超过运营商限制");
        if (((Number)row.get("whitelist_enabled")).intValue() == 1 && jdbc.queryForList(
                "SELECT member_id FROM c_operator_charge_whitelist WHERE tenant_id=? AND member_id=? LOCK IN SHARE MODE",tenant,member).isEmpty())
            throw new ServiceException("当前会员不在运营商充电白名单内");
    }
    @Transactional(readOnly = true)
    public Map<String,Object> get(Long target) {
        Long tenant = authorizeTenant(target);
        Map<String,Object> result = rule(tenant," LOCK IN SHARE MODE");
        result.put("members",jdbc.queryForList("SELECT w.member_id,m.user_name FROM c_operator_charge_whitelist w JOIN c_member m ON m.member_id=w.member_id AND m.tenant_id=w.tenant_id WHERE w.tenant_id=? ORDER BY w.member_id LOCK IN SHARE MODE",tenant));
        return result;
    }
    @Transactional(rollbackFor = Exception.class)
    public void update(Long target, Integer hours, Boolean enabled, Long version) {
        if (hours == null || hours < 1 || hours > 24 || enabled == null || version == null || version < 0)
            throw new ServiceException("充电规则参数无效");
        Long tenant = authorizeTenant(target);
        rule(tenant," FOR UPDATE");
        if (jdbc.update("UPDATE c_operator_charge_rule SET max_charging_hours=?,whitelist_enabled=?,version=version+1,updated_by=? WHERE tenant_id=? AND version=?",hours,enabled ? 1 : 0,SecurityContextHolder.getUserId(),tenant,version) != 1)
            throw new ServiceException("配置已变更，请刷新后重试");
    }
    @Transactional(rollbackFor = Exception.class)
    public void changeMember(Long target, Long member, boolean add, Long version) {
        if (member == null || version == null) throw new ServiceException("会员或版本号不能为空");
        Long tenant = authorizeTenant(target);
        Map<String,Object> row = rule(tenant," FOR UPDATE");
        if (((Number)row.get("version")).longValue() != version) throw new ServiceException("配置已变更，请刷新后重试");
        if (add && jdbc.queryForList("SELECT member_id FROM c_member WHERE member_id=? AND tenant_id=? LOCK IN SHARE MODE",member,tenant).isEmpty())
            throw new ServiceException("会员不存在或不属于本运营商");
        if (add) jdbc.update("INSERT IGNORE INTO c_operator_charge_whitelist(tenant_id,member_id,created_by) VALUES(?,?,?)",tenant,member,SecurityContextHolder.getUserId());
        else jdbc.update("DELETE FROM c_operator_charge_whitelist WHERE tenant_id=? AND member_id=?",tenant,member);
        jdbc.update("UPDATE c_operator_charge_rule SET version=version+1,updated_by=? WHERE tenant_id=?",SecurityContextHolder.getUserId(),tenant);
    }
}
