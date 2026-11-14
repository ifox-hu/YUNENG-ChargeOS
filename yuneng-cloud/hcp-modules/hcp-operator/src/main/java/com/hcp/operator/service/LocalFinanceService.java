package com.hcp.operator.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.domain.LocalOperationRequest;
import com.hcp.common.mybatisplus.tenant.TenantLifecycle;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import static com.hcp.operator.service.LocalOperationSupport.*;

/** 本地余额收款、退款与分账。所有金额变更与流水在同一事务提交。 */
@Service
public class LocalFinanceService
{
    private final JdbcTemplate jdbc;
    private final LocalOperationSupport support;
    private final LocalMarketingService marketing;
    private final ObjectMapper json;
    private final TenantLifecycle lifecycle;

    public LocalFinanceService(JdbcTemplate jdbc, LocalOperationSupport support, LocalMarketingService marketing, ObjectMapper json, TenantLifecycle lifecycle)
    {
        this.jdbc = jdbc;
        this.support = support;
        this.marketing = marketing;
        this.json = json;
        this.lifecycle = lifecycle;
    }

    private Map<String, Object> order(Long tenant, String orderId)
    {
        return support.one("SELECT * FROM c_charging_order WHERE order_id=? AND tenant_id=? FOR UPDATE", orderId, tenant);
    }

    private Map<String, Object> account(Long tenant, Long member)
    {
        support.one("SELECT member_id FROM c_member WHERE member_id=? AND tenant_id=? FOR UPDATE", member, tenant);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM c_menber_balance WHERE member_id=? AND tenant_id=? FOR UPDATE", member, tenant);
        if (rows.size() != 1) throw new ServiceException("余额账户缺失或重复，请先核查");
        return rows.get(0);
    }

    private void balance(Map<String, Object> account, BigDecimal delta, String request, String type, String remark)
    {
        BigDecimal next = new BigDecimal(String.valueOf(account.get("amount"))).add(delta);
        if (next.signum() < 0) throw new ServiceException("余额不足，请先本地模拟充值");
        jdbc.update("UPDATE c_menber_balance SET amount=?,version=COALESCE(version,0)+1,update_time=NOW() WHERE id=?",
            next, account.get("id"));
        jdbc.update("INSERT INTO c_member_balance_ledger(member_id,request_id,type,amount,balance_after,remark) VALUES(?,?,?,?,?,?)",
            account.get("member_id"), request, type, delta, next, remark);
    }

    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public Map<String, Object> pay(Long tenant, Long member, LocalOperationRequest request)
    {
        support.requireLocal();
        String key = text(request.getRequestId(), 80, "请求号");
        Map<String, Object> order = order(tenant, request.getOrderId());
        Long owner = ((Number)order.get("user_id")).longValue();
        if (member != null && !member.equals(owner)) throw new ServiceException("无权支付其他会员订单", 403);
        List<Map<String, Object>> existing = jdbc.queryForList("SELECT * FROM c_local_payment WHERE order_id=?", request.getOrderId());
        if (!existing.isEmpty())
        {
            if (!Objects.equals(existing.get(0).get("coupon_id"), request.getCouponId()))
                throw new ServiceException("订单已付款，请勿更换优惠券重复提交");
            return existing.get(0);
        }
        if (!Arrays.asList("3", "5", "7").contains(String.valueOf(order.get("order_state"))) || !"9003".equals(order.get("charge_status")))
            throw new ServiceException("仅可支付已完成的本地模拟订单");
        lifecycle.requireActive(tenant);
        if (((Number)order.get("device_type")).intValue() != 4) throw new ServiceException("此入口仅用于本地模拟订单");
        BigDecimal gross = money(order.get("ordergold"));
        if (gross.signum() <= 0 || money(order.get("charge_fee")).add(money(order.get("service_fee"))).compareTo(gross) != 0
            || money(order.get("refund_amount") == null ? BigDecimal.ZERO : order.get("refund_amount")).signum() != 0)
            throw new ServiceException("订单费用异常或存在历史退款，请先核查");
        Map<String, Object> account = account(tenant, owner);
        BigDecimal discount = marketing.use(tenant, owner, request.getOrderId(), request.getCouponId(), gross);
        BigDecimal paid = gross.subtract(discount);
        Object station = support.one("SELECT station_id FROM c_charging_pile WHERE pile_id=? AND tenant_id=?", order.get("pile_id"), tenant).get("station_id");
        jdbc.update("INSERT INTO c_local_payment(tenant_id,order_id,member_id,station_id,request_id,gross_amount,discount_amount,paid_amount,coupon_id) VALUES(?,?,?,?,?,?,?,?,?)",
            tenant, request.getOrderId(), owner, station, key, gross, discount, paid, request.getCouponId());
        Map<String, Object> payment = support.one("SELECT * FROM c_local_payment WHERE order_id=?", request.getOrderId());
        if (paid.signum() > 0) balance(account, paid.negate(), "LOCAL_PAY:" + payment.get("id"), "LOCAL_PAYMENT", "本地订单付款");
        return payment;
    }

    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public Map<String, Object> refund(Long tenant, Long actor, LocalOperationRequest request)
    {
        support.requireLocal();
        String key = text(request.getRequestId(), 80, "请求号");
        String reason = text(request.getReason(), 255, "退款原因");
        order(tenant, request.getOrderId());
        Map<String, Object> payment = support.one("SELECT * FROM c_local_payment WHERE tenant_id=? AND order_id=? FOR UPDATE", tenant, request.getOrderId());
        BigDecimal amount = money(request.getAmount());
        List<Map<String, Object>> old = jdbc.queryForList("SELECT * FROM c_local_refund WHERE tenant_id=? AND request_id=?", tenant, key);
        if (!old.isEmpty())
        {
            if (!Objects.equals(old.get(0).get("payment_id"), payment.get("id")) || money(old.get(0).get("amount")).compareTo(amount) != 0
                || !reason.equals(old.get(0).get("reason"))) throw new ServiceException("同一请求号的退款内容不一致");
            return old.get(0);
        }
        BigDecimal paid = money(payment.get("paid_amount")), refunded = money(payment.get("refunded_amount"));
        if (!"PAID".equals(payment.get("status")) || amount.signum() <= 0 || amount.compareTo(paid.subtract(refunded)) > 0)
            throw new ServiceException("退款金额须大于零且不能超过剩余实付");
        Map<String, Object> account = account(tenant, ((Number)payment.get("member_id")).longValue());
        BigDecimal total = refunded.add(amount);
        jdbc.update("INSERT INTO c_local_refund(tenant_id,payment_id,request_id,amount,reason,actor_id) VALUES(?,?,?,?,?,?)",
            tenant, payment.get("id"), key, amount, reason, actor);
        Map<String, Object> refund = support.one("SELECT * FROM c_local_refund WHERE tenant_id=? AND request_id=?", tenant, key);
        balance(account, amount, "LOCAL_REFUND:" + refund.get("id"), "LOCAL_REFUND", reason);
        jdbc.update("UPDATE c_local_payment SET refunded_amount=?,updated_at=NOW(3) WHERE id=?", total, payment.get("id"));
        jdbc.update("UPDATE c_charging_order SET refund_amount=?,order_state=IF(?=1,'4',order_state) WHERE order_id=? AND tenant_id=?",
            total, total.compareTo(paid) == 0 ? 1 : 0, request.getOrderId(), tenant);
        if (total.compareTo(paid) == 0) restoreCoupon(payment);
        reverse(payment, total, ((Number)refund.get("id")).longValue());
        return refund;
    }

    private void restoreCoupon(Map<String, Object> payment)
    {
        if (payment.get("coupon_id") != null)
            jdbc.update("UPDATE c_local_coupon SET status='UNUSED',used_order_id=NULL WHERE id=? AND tenant_id=? AND used_order_id=?",
                payment.get("coupon_id"), payment.get("tenant_id"), payment.get("order_id"));
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelZero(Long tenant, Long actor, LocalOperationRequest request)
    {
        support.requireLocal();
        text(request.getReason(), 255, "撤销原因");
        order(tenant, request.getOrderId());
        Map<String, Object> payment = support.one("SELECT * FROM c_local_payment WHERE tenant_id=? AND order_id=? FOR UPDATE", tenant, request.getOrderId());
        if (money(payment.get("paid_amount")).signum() != 0) throw new ServiceException("正额订单请使用退款");
        if ("CANCELLED".equals(payment.get("status"))) return;
        restoreCoupon(payment);
        jdbc.update("UPDATE c_local_payment SET status='CANCELLED',updated_at=NOW(3) WHERE id=?", payment.get("id"));
        jdbc.update("INSERT INTO c_local_exception_log(tenant_id,order_id,action,note,actor_id) VALUES(?,?,'VOID_COUPON',?,?)",
            tenant, request.getOrderId(), request.getReason(), actor);
    }

    public Map<String, Object> rule(Long tenant)
    {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM c_local_split_rule WHERE tenant_id=?", tenant);
        if (!rows.isEmpty()) return rows.get(0);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("platform_rate", new BigDecimal("10.00")); result.put("version", 0);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveRule(Long tenant, LocalOperationRequest request)
    {
        support.requireLocal();
        BigDecimal rate = money(request.getPlatformRate());
        if (rate.compareTo(new BigDecimal("100")) > 0 || request.getVersion() == null) throw new ServiceException("分成比例或版本无效");
        jdbc.update("INSERT IGNORE INTO c_local_split_rule(tenant_id) VALUES(?)", tenant);
        if (jdbc.update("UPDATE c_local_split_rule SET platform_rate=?,version=version+1 WHERE tenant_id=? AND version=?", rate, tenant, request.getVersion()) != 1)
            throw new ServiceException("分成配置已更新，请刷新后重试");
    }

    private BigDecimal platform(BigDecimal net, BigDecimal rate)
    {
        return net.multiply(rate).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
    }

    @Transactional(rollbackFor = Exception.class)
    public void split(Long tenant, String orderId)
    {
        support.requireLocal();
        order(tenant, orderId);
        Map<String, Object> payment = support.one("SELECT * FROM c_local_payment WHERE tenant_id=? AND order_id=? FOR UPDATE", tenant, orderId);
        if (!jdbc.queryForList("SELECT id FROM c_local_split WHERE payment_id=? AND refund_id=0", payment.get("id")).isEmpty()) return;
        BigDecimal net = money(payment.get("paid_amount")).subtract(money(payment.get("refunded_amount")));
        if (!"PAID".equals(payment.get("status")) || net.signum() <= 0) throw new ServiceException("无可分账净收款");
        BigDecimal rate = money(rule(tenant).get("platform_rate")), platform = platform(net, rate);
        jdbc.update("INSERT INTO c_local_split(tenant_id,payment_id,station_id,platform_rate,platform_amount,station_amount) VALUES(?,?,?,?,?,?)",
            tenant, payment.get("id"), payment.get("station_id"), rate, platform, net.subtract(platform));
    }

    private void reverse(Map<String, Object> payment, BigDecimal refunded, Long refundId)
    {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM c_local_split WHERE payment_id=? AND refund_id=0", payment.get("id"));
        if (rows.isEmpty()) return;
        BigDecimal net = money(payment.get("paid_amount")).subtract(refunded);
        Map<String, Object> current = support.one("SELECT COALESCE(SUM(platform_amount),0) AS platform,COALESCE(SUM(station_amount),0) AS station FROM c_local_split WHERE payment_id=?", payment.get("id"));
        BigDecimal rate = money(rows.get(0).get("platform_rate")), target = platform(net, rate);
        jdbc.update("INSERT INTO c_local_split(tenant_id,payment_id,refund_id,station_id,platform_rate,platform_amount,station_amount) VALUES(?,?,?,?,?,?,?)",
            payment.get("tenant_id"), payment.get("id"), refundId, payment.get("station_id"), rate,
            target.subtract(new BigDecimal(String.valueOf(current.get("platform")))), net.subtract(target).subtract(new BigDecimal(String.valueOf(current.get("station")))));
    }

    public Map<String, Object> list(Long tenant, int page, int size)
    {
        int offset = offset(page, size);
        Map<String, Object> result = page(jdbc.queryForList("SELECT p.*,o.order_number FROM c_local_payment p JOIN c_charging_order o ON o.order_id=p.order_id WHERE p.tenant_id=? ORDER BY p.id DESC LIMIT ? OFFSET ?", tenant, size, offset),
            jdbc.queryForObject("SELECT COUNT(*) FROM c_local_payment WHERE tenant_id=?", Long.class, tenant));
        result.put("refunds", jdbc.queryForList("SELECT r.*,p.order_id FROM c_local_refund r JOIN c_local_payment p ON p.id=r.payment_id WHERE r.tenant_id=? ORDER BY r.id DESC LIMIT 100", tenant));
        result.put("splits", jdbc.queryForList("SELECT s.*,p.order_id FROM c_local_split s JOIN c_local_payment p ON p.id=s.payment_id WHERE s.tenant_id=? ORDER BY s.id DESC LIMIT 100", tenant));
        result.put("batches", jdbc.queryForList("SELECT * FROM c_local_reconcile WHERE tenant_id=? ORDER BY id DESC LIMIT 30", tenant));
        result.put("notes", jdbc.queryForList("SELECT * FROM c_local_reconcile_note WHERE tenant_id=? ORDER BY id DESC LIMIT 100", tenant));
        result.put("rule", rule(tenant));
        return result;
    }

    @Transactional(rollbackFor = Exception.class, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> reconcile(Long tenant, Long actor, String businessDay) throws JsonProcessingException
    {
        LocalDate day = day(businessDay);
        List<Map<String, Object>> payments = jdbc.queryForList("SELECT * FROM c_local_payment WHERE tenant_id=? AND created_at>=? AND created_at<? ORDER BY id", tenant, day.toString(), day.plusDays(1).toString());
        List<Map<String, Object>> details = new ArrayList<>();
        int differences = 0;
        for (Map<String, Object> payment : payments)
        {
            BigDecimal paid = money(payment.get("paid_amount")), refunded = money(payment.get("refunded_amount"));
            BigDecimal debit = jdbc.queryForObject("SELECT COALESCE(-SUM(amount),0) FROM c_member_balance_ledger WHERE member_id=? AND request_id=? AND type='LOCAL_PAYMENT'", BigDecimal.class, payment.get("member_id"), "LOCAL_PAY:" + payment.get("id"));
            BigDecimal refund = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM c_local_refund WHERE payment_id=?", BigDecimal.class, payment.get("id"));
            BigDecimal credit = jdbc.queryForObject("SELECT COALESCE(SUM(l.amount),0) FROM c_local_refund r JOIN c_member_balance_ledger l ON l.request_id=CONCAT('LOCAL_REFUND:',r.id) AND l.member_id=? AND l.type='LOCAL_REFUND' WHERE r.payment_id=?", BigDecimal.class, payment.get("member_id"), payment.get("id"));
            BigDecimal split = jdbc.queryForObject("SELECT SUM(platform_amount+station_amount) FROM c_local_split WHERE payment_id=?", BigDecimal.class, payment.get("id"));
            BigDecimal orderRefund = jdbc.queryForObject("SELECT COALESCE(refund_amount,0) FROM c_charging_order WHERE order_id=? AND tenant_id=?", BigDecimal.class, payment.get("order_id"), tenant);
            boolean match = paid.compareTo(debit) == 0 && refunded.compareTo(refund) == 0 && refund.compareTo(credit) == 0
                && orderRefund.compareTo(refund) == 0 && (split == null || split.compareTo(paid.subtract(refunded)) == 0);
            if (!match) differences++;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("orderId", payment.get("order_id")); row.put("paid", paid); row.put("walletDebit", debit);
            row.put("refunded", refunded); row.put("walletCredit", credit); row.put("split", split); row.put("matched", match);
            details.add(row);
        }
        Integer excluded = jdbc.queryForObject("SELECT COUNT(*) FROM c_charging_order o WHERE o.tenant_id=? AND o.order_state IN ('3','4','5','7') AND COALESCE(o.real_end_time,o.create_time)>=? AND COALESCE(o.real_end_time,o.create_time)<? AND NOT EXISTS(SELECT 1 FROM c_local_payment p WHERE p.order_id=o.order_id)", Integer.class, tenant, day.toString(), day.plusDays(1).toString());
        jdbc.update("INSERT INTO c_local_reconcile(tenant_id,business_day,checked_count,difference_count,excluded_count,details,actor_id) VALUES(?,?,?,?,?,?,?)",
            tenant, day.toString(), payments.size(), differences, excluded, json.writeValueAsString(details), actor);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checked", payments.size()); result.put("differences", differences); result.put("excluded", excluded); result.put("details", details);
        return result;
    }

    public void note(Long tenant, Long actor, LocalOperationRequest request)
    {
        support.requireLocal();
        support.one("SELECT id FROM c_local_reconcile WHERE id=? AND tenant_id=?", request.getBatchId(), tenant);
        jdbc.update("INSERT INTO c_local_reconcile_note(tenant_id,batch_id,note,actor_id) VALUES(?,?,?,?)", tenant, request.getBatchId(), text(request.getReason(), 255, "处理说明"), actor);
    }
}
