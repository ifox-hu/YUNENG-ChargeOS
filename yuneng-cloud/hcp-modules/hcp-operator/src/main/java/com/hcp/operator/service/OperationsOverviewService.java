package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.hcp.operator.service.LocalOperationSupport.*;

/** 仪表盘、订单资金视图与异常核查，所有查询显式限定租户。 */
@Service
public class OperationsOverviewService
{
    private final JdbcTemplate jdbc;
    private final LocalOperationSupport support;
    private static final String FROM = " FROM c_charging_order o LEFT JOIN c_charging_pile p ON p.pile_id=o.pile_id AND p.tenant_id=o.tenant_id "
        + "LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=o.tenant_id "
        + "LEFT JOIN c_local_payment f ON f.order_id=o.order_id AND f.tenant_id=o.tenant_id ";
    private static final String EXCEPTION = "CASE "
        + "WHEN o.order_state='1' AND o.charge_status='9001' AND (o.stop_reason LIKE '%待确认%' OR TIMESTAMPDIFF(MINUTE,o.start_time,NOW())>30) THEN 'START_UNCERTAIN' "
        + "WHEN o.order_state='1' AND o.charge_status='9002' AND TIMESTAMPDIFF(HOUR,o.start_time,NOW())>24 THEN 'LONG_RUNNING' "
        + "WHEN o.order_state='6' AND TIMESTAMPDIFF(MINUTE,COALESCE(o.real_end_time,o.create_time),NOW())>30 THEN 'SETTLEMENT_TIMEOUT' "
        + "WHEN o.order_state IN ('3','4','5','7') AND (o.ordergold IS NULL OR o.ordergold NOT REGEXP '^[0-9]+(\\.[0-9]{1,6})?$' OR o.charge_fee IS NULL OR o.service_fee IS NULL "
        + "OR ROUND(CAST(o.ordergold AS DECIMAL(18,6)),2)<>ROUND(o.charge_fee+o.service_fee,2)) THEN 'AMOUNT_MISMATCH' "
        + "WHEN o.order_state IN ('3','4','5','7') AND (COALESCE(o.end_time,'')='' OR o.real_end_time IS NULL) THEN 'INCOMPLETE_END' ELSE NULL END";

    public OperationsOverviewService(JdbcTemplate jdbc, LocalOperationSupport support)
    {
        this.jdbc = jdbc;
        this.support = support;
    }

    public Map<String, Object> overview(Long tenant, String from, String to, Long stationId)
    {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        LocalDate start = from == null ? today.minusDays(6) : day(from), end = to == null ? today : day(to);
        if (end.isBefore(start) || start.plusDays(366).isBefore(end)) throw new ServiceException("日期范围须为1至367天");
        String where = " WHERE o.tenant_id=? AND COALESCE(o.real_end_time,o.create_time)>=? AND COALESCE(o.real_end_time,o.create_time)<?";
        List<Object> args = new ArrayList<>(Arrays.asList(tenant, start.toString(), end.plusDays(1).toString()));
        if (stationId != null)
        {
            support.one("SELECT station_id FROM c_charging_station WHERE station_id=? AND tenant_id=?", stationId, tenant);
            where += " AND p.station_id=?"; args.add(stationId);
        }
        String settled = "o.order_state IN ('3','4','5','7')";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantId", tenant);
        result.put("summary", support.one("SELECT COUNT(*) AS orders,COALESCE(SUM(IF(" + settled + ",CAST(o.ordergold AS DECIMAL(18,2)),0)),0) AS gross,"
            + "COALESCE(SUM(IF(" + settled + ",o.consume_power,0)),0) AS power,COALESCE(SUM(IF(f.status='PAID',f.paid_amount-f.refunded_amount,0)),0) AS net,"
            + "COALESCE(SUM(f.discount_amount),0) AS discount,COALESCE(SUM(f.refunded_amount),0) AS refunded" + FROM + where, args.toArray()));
        result.put("trend", jdbc.queryForList("SELECT DATE_FORMAT(COALESCE(o.real_end_time,o.create_time),'%Y-%m-%d') AS day,COUNT(*) AS orders,"
            + "COALESCE(SUM(IF(" + settled + ",o.consume_power,0)),0) AS power,COALESCE(SUM(IF(f.status='PAID',f.paid_amount-f.refunded_amount,0)),0) AS net"
            + FROM + where + " GROUP BY day ORDER BY day", args.toArray()));
        result.put("ranking", jdbc.queryForList("SELECT COALESCE(s.station_name,'未归属站点') AS name,COUNT(*) AS orders,"
            + "COALESCE(SUM(IF(f.status='PAID',f.paid_amount-f.refunded_amount,0)),0) AS net" + FROM + where + " GROUP BY s.station_id,s.station_name ORDER BY net DESC,orders DESC LIMIT 8", args.toArray()));
        String deviceWhere = " WHERE tenant_id=?" + (stationId == null ? "" : " AND station_id=?");
        Object[] deviceArgs = stationId == null ? new Object[]{tenant} : new Object[]{tenant, stationId};
        result.put("devices", jdbc.queryForList("SELECT running_status AS status,COUNT(*) AS count FROM c_charging_pile" + deviceWhere + " AND COALESCE(deleted,0)=0 GROUP BY running_status", deviceArgs));
        Map<String, Object> pending = new LinkedHashMap<>();
        pending.put("exceptions", jdbc.queryForObject("SELECT COUNT(*) FROM c_charging_order o WHERE o.tenant_id=? AND (" + EXCEPTION + ") IS NOT NULL", Long.class, tenant));
        pending.put("faults", jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE tenant_id=? AND status<>'CLOSED'", Long.class, tenant));
        pending.put("points", jdbc.queryForObject("SELECT COUNT(*) FROM c_points_event WHERE tenant_id=? AND status='DEAD'", Long.class, tenant));
        result.put("pending", pending);
        result.put("stations", jdbc.queryForList("SELECT station_id,station_name FROM c_charging_station WHERE tenant_id=? AND COALESCE(del_flag,0)=0 ORDER BY station_id LIMIT 1000", tenant));
        result.put("basis", "按订单结算日期（未结束取创建日期）筛选；净收为关联订单当前累计本地实付减退款，待办及设备为当前状态");
        return result;
    }

    public Map<String, Object> orders(Long tenant, boolean exceptions, String keyword, int page, int size)
    {
        int offset = offset(page, size);
        List<Object> args = new ArrayList<>(); args.add(tenant);
        String where = " WHERE o.tenant_id=?";
        if (exceptions) where += " AND (" + EXCEPTION + ") IS NOT NULL";
        if (keyword != null && !keyword.trim().isEmpty())
        {
            where += " AND (o.order_number LIKE ? OR o.pile_id LIKE ?)";
            args.add("%" + keyword.trim() + "%"); args.add("%" + keyword.trim() + "%");
        }
        long total = jdbc.queryForObject("SELECT COUNT(*)" + FROM + where, Long.class, args.toArray());
        args.add(size); args.add(offset);
        return page(jdbc.queryForList("SELECT o.order_id,o.order_number,o.user_id,o.order_state,o.charge_status,o.pile_id,o.start_time,o.end_time,o.ordergold,o.charge_fee,o.service_fee,o.consume_power,o.stop_reason,"
            + "s.station_name,f.id AS payment_id,f.coupon_id,f.status AS payment_status,f.discount_amount,f.paid_amount,f.refunded_amount,"
            + "(" + EXCEPTION + ") AS exception_type" + FROM + where + " ORDER BY o.create_time DESC,o.order_id DESC LIMIT ? OFFSET ?", args.toArray()), total);
    }

    public Map<String, Object> detail(Long tenant, String orderId)
    {
        Map<String, Object> order = support.one("SELECT o.*,s.station_name,f.id AS payment_id,f.paid_amount,f.refunded_amount,f.discount_amount,f.status AS payment_status" + FROM + " WHERE o.order_id=? AND o.tenant_id=?", orderId, tenant);
        Map<String, Object> result = new LinkedHashMap<>(); result.put("order", order);
        result.put("logs", jdbc.queryForList("SELECT * FROM c_order_log WHERE order_number=? AND tenant_id=? ORDER BY create_time", order.get("order_number"), tenant));
        result.put("handling", jdbc.queryForList("SELECT * FROM c_local_exception_log WHERE order_id=? AND tenant_id=? ORDER BY id DESC", orderId, tenant));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void handle(Long tenant, Long actor, String orderId, String action, String note)
    {
        support.requireLocal();
        text(note, 255, "处理说明");
        Map<String, Object> order = support.one("SELECT * FROM c_charging_order WHERE order_id=? AND tenant_id=? FOR UPDATE", orderId, tenant);
        if (!Arrays.asList("NOTE", "RECHECK", "CANCEL").contains(action)) throw new ServiceException("不支持的处理动作");
        if ("CANCEL".equals(action))
        {
            if ("2".equals(order.get("order_state"))) return;
            // 预占订单也处于1/9001，不能据此推断设备未启动。取消由原启停流程确认后执行。
            throw new ServiceException("尚无设备确认未启动的证据，请通过原启停流程确认，不可直接取消订单");
        }
        jdbc.update("INSERT INTO c_local_exception_log(tenant_id,order_id,action,note,actor_id) VALUES(?,?,?,?,?)", tenant, orderId, action, note, actor);
    }
}
