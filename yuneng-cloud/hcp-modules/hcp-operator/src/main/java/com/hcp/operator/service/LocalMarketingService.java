package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.domain.LocalOperationRequest;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.hcp.operator.service.LocalOperationSupport.*;

/** 满减券模板、发放与查询。核销由付款事务统一完成。 */
@Service
public class LocalMarketingService
{
    private final JdbcTemplate jdbc;
    private final LocalOperationSupport support;

    public LocalMarketingService(JdbcTemplate jdbc, LocalOperationSupport support)
    {
        this.jdbc = jdbc;
        this.support = support;
    }

    public Map<String, Object> list(Long tenant, Long memberId, int page, int size)
    {
        int offset = offset(page, size);
        Map<String, Object> result = page(jdbc.queryForList(
            "SELECT * FROM c_local_coupon_template WHERE tenant_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
            tenant, size, offset), jdbc.queryForObject("SELECT COUNT(*) FROM c_local_coupon_template WHERE tenant_id=?", Long.class, tenant));
        if (memberId != null)
            support.one("SELECT member_id FROM c_member WHERE member_id=? AND tenant_id=?", memberId, tenant);
        String filter = memberId == null ? "" : " AND c.member_id=?";
        List<Object> args = new ArrayList<>();
        args.add(tenant);
        if (memberId != null) args.add(memberId);
        result.put("coupons", jdbc.queryForList(
            "SELECT c.*,t.name,t.threshold_amount,t.discount_amount,t.valid_from,t.valid_to,"
            + "(NOW() BETWEEN t.valid_from AND t.valid_to) AS in_date FROM c_local_coupon c "
            + "JOIN c_local_coupon_template t ON t.id=c.template_id AND t.tenant_id=c.tenant_id "
            + "WHERE c.tenant_id=?" + filter + " ORDER BY c.id DESC LIMIT 100", args.toArray()));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void save(Long tenant, LocalOperationRequest request)
    {
        support.requireLocal();
        if (request.getTemplateId() != null)
        {
            if (request.getEnabled() == null) throw new ServiceException("请指定启停状态");
            if (jdbc.update("UPDATE c_local_coupon_template SET enabled=? WHERE id=? AND tenant_id=?",
                request.getEnabled() ? 1 : 0, request.getTemplateId(), tenant) != 1)
                throw new ServiceException("优惠券模板不存在");
            return;
        }
        String name = text(request.getName(), 60, "券名称");
        BigDecimal threshold = money(request.getThresholdAmount()), discount = money(request.getDiscountAmount());
        if (discount.signum() <= 0 || discount.compareTo(threshold) > 0)
            throw new ServiceException("优惠须大于零且不能超过门槛");
        if (request.getTotalCount() == null || request.getTotalCount() < 1 || request.getTotalCount() > 100000)
            throw new ServiceException("发行数量须为1至100000");
        LocalDateTime from, to;
        try
        {
            from = LocalDateTime.parse(request.getValidFrom().replace(' ', 'T'));
            to = LocalDateTime.parse(request.getValidTo().replace(' ', 'T'));
        }
        catch (Exception ex) { throw new ServiceException("请填写有效的起止时间"); }
        if (!from.isBefore(to)) throw new ServiceException("结束时间须晚于开始时间");
        jdbc.update("INSERT INTO c_local_coupon_template(tenant_id,name,threshold_amount,discount_amount,valid_from,valid_to,total_count) VALUES(?,?,?,?,?,?,?)",
            tenant, name, threshold, discount, java.sql.Timestamp.valueOf(from), java.sql.Timestamp.valueOf(to), request.getTotalCount());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> issue(Long tenant, LocalOperationRequest request)
    {
        support.requireLocal();
        String key = text(request.getRequestId(), 80, "请求号");
        Map<String, Object> template = support.one("SELECT * FROM c_local_coupon_template WHERE id=? AND tenant_id=? FOR UPDATE",
            request.getTemplateId(), tenant);
        support.one("SELECT member_id FROM c_member WHERE member_id=? AND tenant_id=?", request.getMemberId(), tenant);
        List<Map<String, Object>> old = jdbc.queryForList("SELECT * FROM c_local_coupon WHERE tenant_id=? AND request_id=?", tenant, key);
        if (!old.isEmpty())
        {
            if (!Objects.equals(((Number)old.get(0).get("template_id")).longValue(), request.getTemplateId())
                || !Objects.equals(((Number)old.get(0).get("member_id")).longValue(), request.getMemberId()))
                throw new ServiceException("同一请求号的发券内容不一致");
            return old.get(0);
        }
        if (jdbc.update("UPDATE c_local_coupon_template SET issued_count=issued_count+1 WHERE id=? AND tenant_id=? AND enabled=1 AND issued_count<total_count AND valid_to>NOW()",
            request.getTemplateId(), tenant) != 1) throw new ServiceException("模板已停发、过期或额度用尽");
        jdbc.update("INSERT INTO c_local_coupon(tenant_id,template_id,member_id,request_id) VALUES(?,?,?,?)",
            tenant, request.getTemplateId(), request.getMemberId(), key);
        return support.one("SELECT * FROM c_local_coupon WHERE tenant_id=? AND request_id=?", tenant, key);
    }

    public BigDecimal use(Long tenant, Long member, String orderId, Long couponId, BigDecimal gross)
    {
        if (couponId == null) return BigDecimal.ZERO.setScale(2);
        Map<String, Object> coupon = support.one(
            "SELECT c.id,t.threshold_amount,t.discount_amount FROM c_local_coupon c JOIN c_local_coupon_template t ON t.id=c.template_id AND t.tenant_id=c.tenant_id "
            + "WHERE c.id=? AND c.tenant_id=? AND c.member_id=? AND c.status='UNUSED' AND NOW() BETWEEN t.valid_from AND t.valid_to FOR UPDATE",
            couponId, tenant, member);
        if (gross.compareTo(money(coupon.get("threshold_amount"))) < 0) throw new ServiceException("订单未达到用券门槛");
        if (jdbc.update("UPDATE c_local_coupon SET status='USED',used_order_id=? WHERE id=? AND status='UNUSED'", orderId, couponId) != 1)
            throw new ServiceException("优惠券已使用");
        return money(coupon.get("discount_amount")).min(gross);
    }
}
