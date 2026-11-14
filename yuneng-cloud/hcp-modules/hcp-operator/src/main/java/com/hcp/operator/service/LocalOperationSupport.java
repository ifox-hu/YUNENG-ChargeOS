package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.security.utils.SecurityUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** 共用的本地开关、租户边界和金额校验，不接受客户端覆盖登录身份。 */
@Component
public class LocalOperationSupport
{
    private final JdbcTemplate jdbc;
    @Value("${hcp.operations.local-enabled:false}")
    private boolean localEnabled;

    public LocalOperationSupport(JdbcTemplate jdbc)
    {
        this.jdbc = jdbc;
    }

    public void requireLocal()
    {
        if (!localEnabled) throw new ServiceException("本地资金与营销操作未开启");
    }

    public Long tenant(Long target)
    {
        if (SecurityUtils.getUserId() == null || SecurityUtils.getUserId() <= 0)
            throw new ServiceException("请先登录后台账号", 401);
        Long current = SecurityUtils.getTenantId();
        if (target != null && !target.equals(current) && !SecurityUtils.isAdmin(SecurityUtils.getUserId()))
            throw new ServiceException("无权操作其他运营商", 403);
        return target == null ? current : target;
    }

    public Map<String, Object> one(String sql, Object... args)
    {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        if (rows.isEmpty()) throw new ServiceException("记录不存在或不属于当前运营商", 403);
        return rows.get(0);
    }

    public static BigDecimal money(Object value)
    {
        try
        {
            BigDecimal amount = new BigDecimal(String.valueOf(value));
            if (amount.signum() < 0 || amount.compareTo(new BigDecimal("9999999999.99")) > 0)
                throw new IllegalArgumentException();
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        }
        catch (Exception ex) { throw new ServiceException("金额须为非负数且最多两位小数"); }
    }

    public static String text(String value, int length, String label)
    {
        if (value == null || value.trim().isEmpty() || value.trim().length() > length)
            throw new ServiceException(label + "不能为空且不能超过" + length + "字");
        return value.trim();
    }

    public static LocalDate day(String value)
    {
        try { return LocalDate.parse(value); }
        catch (Exception ex) { throw new ServiceException("日期须为yyyy-MM-dd格式"); }
    }

    public static int offset(int page, int size)
    {
        if (page < 1 || page > 100000 || size < 1 || size > 100) throw new ServiceException("分页参数不合法");
        return (page - 1) * size;
    }

    public static Map<String, Object> page(List<Map<String, Object>> records, long total)
    {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", records);
        result.put("total", total);
        return result;
    }
}
