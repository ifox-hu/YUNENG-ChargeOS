package com.hcp.operator.mapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Repository
public class OperationsDashboardQueries {
    private static final String JOIN =
            " FROM c_charging_order o LEFT JOIN c_charging_pile p ON p.pile_id=o.pile_id AND p.tenant_id=o.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1";
    private static final String SALES =
            "COALESCE(SUM(CASE WHEN o.order_state IN ('3','4','5','6','7') THEN CAST(COALESCE(NULLIF(o.ordergold,''),'0') AS DECIMAL(18,6)) ELSE 0 END),0)";
    private static final String REFUND =
            "COALESCE(SUM(CASE WHEN o.order_state='4' THEN o.refund_amount ELSE 0 END),0)";
    private static final String ACTIVE_DEVICES =
            "COUNT(DISTINCT CASE WHEN COALESCE(p.deleted,0)=0 THEN p.pile_id ELSE NULL END) AS activeDeviceCount";
    private static final String OFFLINE_FROM =
            " FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0 AND p.running_status=1";

    private final JdbcTemplate jdbc;

    public OperationsDashboardQueries(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> listOperators(boolean root, Long tenantId) {
        List<Object> args =
                root || tenantId == null
                        ? Collections.emptyList()
                        : Collections.singletonList(tenantId);
        return rows(
                "SELECT id,tenant_name AS name FROM sys_tenant t WHERE COALESCE(t.del_flag,'0')='0'"
                        + (args.isEmpty() ? "" : " AND t.id=?")
                        + " ORDER BY id",
                args);
    }

    public List<Map<String, Object>> listHistoricalTenantIds() {
        return jdbc.queryForList(
                "SELECT DISTINCT tenant_id AS id FROM c_charging_station WHERE tenant_id IS NOT NULL AND COALESCE(del_flag,0)=0 UNION SELECT DISTINCT tenant_id AS id FROM c_charging_order WHERE tenant_id IS NOT NULL");
    }

    public List<Map<String, Object>> listStationOptions(Long tenantId) {
        List<Object> args =
                tenantId == null ? Collections.emptyList() : Collections.singletonList(tenantId);
        return rows(
                "SELECT s.station_id AS stationId,s.station_name AS stationName,s.tenant_id AS tenantId,s.address,s.region_code AS regionCode,s.province,s.city,s.lat,s.lng FROM c_charging_station s WHERE COALESCE(s.del_flag,0)=0"
                        + (args.isEmpty() ? "" : " AND s.tenant_id=?")
                        + " ORDER BY s.station_id",
                args);
    }

    public Map<String, Object> summarizeOrders(String orderWhere, List<Object> args) {
        return one(
                "SELECT "
                        + SALES
                        + " AS sumSales,"
                        + REFUND
                        + " AS reSales,COALESCE(SUM(o.consume_power),0) AS consumePower,COUNT(*) AS chargeTimes"
                        + JOIN
                        + orderWhere,
                args);
    }

    public Map<String, Object> summarizeComparison(
            String previousWhere, List<Object> previousArgs) {
        return one(
                "SELECT "
                        + SALES
                        + "-"
                        + REFUND
                        + " AS realSales,COUNT(*) AS chargeTimes,COALESCE(SUM(o.consume_power),0) AS consumePower"
                        + JOIN
                        + previousWhere,
                previousArgs);
    }

    public List<Map<String, Object>> listHourlyOrders(String orderWhere, List<Object> args) {
        return rows(
                "SELECT HOUR(o.create_time) AS hour,COUNT(*) AS count,COALESCE(SUM(o.consume_power),0) AS power"
                        + JOIN
                        + orderWhere
                        + " GROUP BY HOUR(o.create_time)",
                args);
    }

    public List<Map<String, Object>> listOrderStates(String orderWhere, List<Object> args) {
        return rows(
                "SELECT COALESCE(o.order_state,'unknown') AS state,COUNT(*) AS count"
                        + JOIN
                        + orderWhere
                        + " GROUP BY o.order_state",
                args);
    }

    public Map<String, Object> summarizeDevices(String pileWhere, List<Object> args) {
        return one(
                "SELECT COUNT(*) AS totalNumbers,COALESCE(SUM(p.running_status=0),0) AS onLine,COALESCE(SUM(p.running_status=1),0) AS offLine,COALESCE(SUM(p.running_status IS NULL OR p.running_status NOT IN(0,1)),0) AS unknownState FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0"
                        + pileWhere,
                args);
    }

    public java.sql.Date currentDate() {
        return jdbc.queryForObject("SELECT CURDATE()", java.sql.Date.class);
    }

    public List<Map<String, Object>> listDailyOrders(String orderWhere, List<Object> args) {
        return rows(
                "SELECT DATE_FORMAT(o.create_time,'%Y-%m-%d') AS day,"
                        + SALES
                        + "-"
                        + REFUND
                        + " AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count"
                        + JOIN
                        + orderWhere
                        + " GROUP BY DATE_FORMAT(o.create_time,'%Y-%m-%d') ORDER BY day",
                args);
    }

    public List<Map<String, Object>> listStationOrders(String orderWhere, List<Object> args) {
        return rows(
                "SELECT s.station_id AS stationId,"
                        + SALES
                        + "-"
                        + REFUND
                        + " AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count,"
                        + ACTIVE_DEVICES
                        + JOIN
                        + orderWhere
                        + " AND s.station_id IS NOT NULL GROUP BY s.station_id",
                args);
    }

    public List<Map<String, Object>> countStationDevices(String pileWhere, List<Object> args) {
        return rows(
                "SELECT p.station_id AS stationId,p.tenant_id AS tenantId,COUNT(*) AS deviceCount FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0"
                        + pileWhere
                        + " GROUP BY p.station_id,p.tenant_id",
                args);
    }

    public List<Map<String, Object>> listOperatorOrders(String orderWhere, List<Object> args) {
        return rows(
                "SELECT o.tenant_id AS tenantId,"
                        + SALES
                        + "-"
                        + REFUND
                        + " AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count,"
                        + ACTIVE_DEVICES
                        + JOIN
                        + orderWhere
                        + " GROUP BY o.tenant_id",
                args);
    }

    public Map<String, Object> summarizeOfflineDevices(String offlineWhere, List<Object> args) {
        return one(
                "SELECT COALESCE(SUM(p.offline_time<=DATE_SUB(NOW(),INTERVAL 24 HOUR)),0) AS offline24Count,COALESCE(SUM(p.offline_time IS NULL OR p.offline_time>NOW()),0) AS offlineUnknownCount"
                        + (OFFLINE_FROM + offlineWhere),
                args);
    }

    public List<Map<String, Object>> listOfflineDevices(String offlineWhere, List<Object> args) {
        return rows(
                "SELECT p.pile_id AS pileId,p.name,s.station_name AS stationName,p.offline_time AS offlineTime,CASE WHEN p.offline_time<=NOW() THEN TIMESTAMPDIFF(MINUTE,p.offline_time,NOW()) ELSE NULL END AS offlineMinutes"
                        + (OFFLINE_FROM + offlineWhere)
                        + " ORDER BY p.offline_time IS NULL,p.offline_time ASC,p.pile_id LIMIT 20",
                args);
    }

    public List<Map<String, Object>> listDeviceAlarms(String alarmWhere, List<Object> args) {
        return rows(
                "SELECT a.id,a.description,a.pile_id AS pileId,a.occurred_at AS occurredAt,a.received_at AS receivedAt,a.priority FROM c_device_alarm_event a LEFT JOIN c_charging_pile p ON p.pile_id=a.pile_id AND p.tenant_id=a.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1"
                        + alarmWhere
                        + " ORDER BY a.received_at DESC,a.id DESC LIMIT 6",
                args);
    }

    public Map<String, Object> summarizeFaults(String faultWhere, List<Object> args) {
        return one(
                "SELECT COALESCE(SUM(t.status<>'CLOSED'),0) AS active,COALESCE(SUM(t.status='CLOSED'),0) AS closed,COALESCE(SUM(t.status='NEW'),0) AS pending,COALESCE(SUM(t.status='RESOLVED'),0) AS resolved FROM c_fault_ticket t LEFT JOIN c_charging_pile p ON p.pile_id=t.pile_id AND p.tenant_id=t.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1"
                        + faultWhere,
                args);
    }

    public List<Map<String, Object>> listPendingFaults(String faultWhere, List<Object> args) {
        return rows(
                "SELECT t.id,t.ticket_no AS ticketNo,t.pile_id AS pileId,t.status,t.description,t.created_at AS createdAt,CASE WHEN t.created_at<=NOW() THEN TIMESTAMPDIFF(MINUTE,t.created_at,NOW()) ELSE NULL END AS ageMinutes,s.station_name AS stationName FROM c_fault_ticket t LEFT JOIN c_charging_pile p ON p.pile_id=t.pile_id AND p.tenant_id=t.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE t.status<>'CLOSED'"
                        + faultWhere
                        + " ORDER BY t.created_at ASC,t.id ASC LIMIT 20",
                args);
    }

    private List<Map<String, Object>> rows(String sql, List<Object> args) {
        return jdbc.queryForList(sql, args.toArray());
    }

    private Map<String, Object> one(String sql, List<Object> args) {
        return rows(sql, args).get(0);
    }
}
