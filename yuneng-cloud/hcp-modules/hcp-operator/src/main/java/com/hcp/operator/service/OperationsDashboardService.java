package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.operator.mapper.OperationsDashboardQueries;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Read-only dashboard aggregates for the authenticated operator scope. */
@Service
public class OperationsDashboardService {
    private final OperationsDashboardQueries queries;
    private final FaultTicketService tickets;

    public OperationsDashboardService(
            OperationsDashboardQueries queries, FaultTicketService tickets) {
        this.queries = queries;
        this.tickets = tickets;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(
            Long tenantId, Long stationId, String startDate, String endDate) {
        FaultTicketService.Scope identity = tickets.operator();
        LocalDate start = null, end = null;
        if (startDate != null || endDate != null) {
            try {
                if (startDate == null
                        || endDate == null
                        || !startDate.matches("\\d{4}-\\d{2}-\\d{2}")
                        || !endDate.matches("\\d{4}-\\d{2}-\\d{2}"))
                    throw new IllegalArgumentException();
                start = LocalDate.parse(startDate);
                end = LocalDate.parse(endDate);
                if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 365)
                    throw new IllegalArgumentException();
            } catch (RuntimeException invalid) {
                throw new ServiceException("请选择有效日期范围，最多366天", 400);
            }
        }
        if (!identity.root && tenantId != null && !tenantId.equals(identity.tenant))
            throw new ServiceException("无权查看其他运营商", 403);
        Long selected = identity.root ? tenantId : identity.tenant;
        List<Map<String, Object>> operators = queries.listOperators(identity.root, identity.tenant);
        // Keep historical data attributable when an old tenant no longer has a registry row.
        if (identity.root)
            for (Map<String, Object> row : queries.listHistoricalTenantIds()) {
                if (operators.stream()
                        .noneMatch(
                                o ->
                                        String.valueOf(o.get("id"))
                                                .equals(String.valueOf(row.get("id"))))) {
                    row.put("name", "运营商 #" + row.get("id"));
                    operators.add(row);
                }
            }
        if (selected != null
                && identity.root
                && operators.stream()
                        .noneMatch(
                                o -> String.valueOf(o.get("id")).equals(String.valueOf(selected))))
            throw new ServiceException("运营商不存在", 404);
        List<Map<String, Object>> options = queries.listStationOptions(selected);
        if (stationId != null
                && options.stream()
                        .noneMatch(
                                s ->
                                        String.valueOf(s.get("stationId"))
                                                .equals(String.valueOf(stationId))))
            throw new ServiceException("站点不存在或不属于当前运营商", 403);
        List<Map<String, Object>> stations = new ArrayList<>();
        for (Map<String, Object> s : options)
            if (stationId == null
                    || String.valueOf(s.get("stationId")).equals(String.valueOf(stationId)))
                stations.add(s);
        Map<String, Object> result = new LinkedHashMap<>(), scope = new LinkedHashMap<>();
        scope.put("root", identity.root);
        scope.put("tenantId", selected);
        scope.put("stationId", stationId);
        result.put("scope", scope);
        result.put("operators", operators);
        result.put("stationOptions", options);
        result.put("stations", stations);

        addOrderMetrics(result, selected, stationId, start, end, stations.size());
        addTrend(result, selected, stationId, start, end);
        addBusinessStats(result, selected, stationId, start, end, stations, operators);
        addAlerts(result, identity, selected, stationId);
        return result;
    }

    private void addOrderMetrics(
            Map<String, Object> result,
            Long selected,
            Long stationId,
            LocalDate start,
            LocalDate end,
            int stationCount) {
        List<Object> args = new ArrayList<>();
        String orderWhere =
                tenant("o", selected, args) + station(stationId, args) + period(start, end, args);
        Map<String, Object> summary = queries.summarizeOrders(orderWhere, args);
        summary.put(
                "realSales",
                new BigDecimal(summary.get("sumSales").toString())
                        .subtract(new BigDecimal(summary.get("reSales").toString())));
        Map<String, Object> periodComparison = new LinkedHashMap<>();
        periodComparison.put("available", start != null);
        if (start != null) {
            long length = ChronoUnit.DAYS.between(start, end) + 1;
            LocalDate previousEnd = start.minusDays(1), previousStart = start.minusDays(length);
            List<Object> previousArgs = new ArrayList<>();
            String previousWhere =
                    tenant("o", selected, previousArgs)
                            + station(stationId, previousArgs)
                            + period(previousStart, previousEnd, previousArgs);
            Map<String, Object> previous = queries.summarizeComparison(previousWhere, previousArgs);
            Map<String, Object> previousPeriod = new LinkedHashMap<>();
            previousPeriod.put("startDate", previousStart.toString());
            previousPeriod.put("endDate", previousEnd.toString());
            periodComparison.put("period", previousPeriod);
            periodComparison.put("summary", previous);
        }
        result.put("comparison", periodComparison);
        // These aggregates use the exact same order scope and date boundaries as the KPI totals.
        List<Map<String, Object>> hourGroups = queries.listHourlyOrders(orderWhere, args);
        Map<String, Map<String, Object>> hoursByKey = index(hourGroups, "hour");
        List<Map<String, Object>> hourly = new ArrayList<>();
        for (int hour = 0; hour < 24; hour++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("hour", hour);
            item.put("count", 0);
            item.put("power", 0);
            if (hoursByKey.containsKey(String.valueOf(hour)))
                item.putAll(hoursByKey.get(String.valueOf(hour)));
            hourly.add(item);
        }
        result.put("hourly", hourly);
        Map<String, Map<String, Object>> states =
                index(queries.listOrderStates(orderWhere, args), "state");
        String[] stateNames = {"下单", "取消", "支付成功", "退款", "完成", "结算中", "手动结算"};
        List<Map<String, Object>> stateRows = new ArrayList<>();
        for (int i = 0; i < stateNames.length; i++) {
            String key = String.valueOf(i + 1);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("state", key);
            item.put("name", stateNames[i]);
            item.put("count", states.containsKey(key) ? states.remove(key).get("count") : 0);
            stateRows.add(item);
        }
        long otherCount = 0;
        for (Map<String, Object> item : states.values())
            otherCount += ((Number) item.get("count")).longValue();
        Map<String, Object> other = new LinkedHashMap<>();
        other.put("state", "unknown");
        other.put("name", "其他/未识别");
        other.put("count", otherCount);
        stateRows.add(other);
        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("states", stateRows);
        quality.put("refundCount", stateRows.get(3).get("count"));
        quality.put("refundAmount", summary.get("reSales"));
        quality.put("cancelledCount", stateRows.get(1).get("count"));
        result.put("orderQuality", quality);
        args = new ArrayList<>();
        String pileWhere = tenant("p", selected, args) + station(stationId, args);
        summary.putAll(queries.summarizeDevices(pileWhere, args));
        summary.put("stationTotal", stationCount);
        result.put("summary", summary);
    }

    private void addTrend(
            Map<String, Object> result,
            Long selected,
            Long stationId,
            LocalDate start,
            LocalDate end) {
        LocalDate today = queries.currentDate().toLocalDate();
        LocalDate trendStart = start == null ? today.minusDays(29) : start,
                trendEnd = end == null ? today : end;
        Map<String, Object> dateRange = new LinkedHashMap<>();
        dateRange.put("startDate", trendStart.toString());
        dateRange.put("endDate", trendEnd.toString());
        dateRange.put("filtered", start != null);
        result.put("period", dateRange);
        List<Object> args = new ArrayList<>();
        String orderWhere =
                tenant("o", selected, args)
                        + station(stationId, args)
                        + period(trendStart, trendEnd, args);
        List<Map<String, Object>> days = queries.listDailyOrders(orderWhere, args);
        List<Map<String, Object>> trend = new ArrayList<>();
        for (LocalDate date = trendStart; !date.isAfter(trendEnd); date = date.plusDays(1)) {
            String day = date.toString();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("day", day);
            item.put("revenue", 0);
            item.put("power", 0);
            item.put("count", 0);
            for (Map<String, Object> d : days) if (day.equals(d.get("day"))) item.putAll(d);
            trend.add(item);
        }
        result.put("trend", trend);
    }

    private void addBusinessStats(
            Map<String, Object> result,
            Long selected,
            Long stationId,
            LocalDate start,
            LocalDate end,
            List<Map<String, Object>> stations,
            List<Map<String, Object>> operators) {
        List<Object> args = new ArrayList<>();
        String orderWhere =
                tenant("o", selected, args) + station(stationId, args) + period(start, end, args);
        List<Map<String, Object>> stationOrders = queries.listStationOrders(orderWhere, args);
        Map<String, Map<String, Object>> byStation = index(stationOrders, "stationId");
        args = new ArrayList<>();
        String pileWhere = tenant("p", selected, args) + station(stationId, args);
        List<Map<String, Object>> pileGroups = queries.countStationDevices(pileWhere, args);
        List<Map<String, Object>> stationStats = new ArrayList<>();
        for (Map<String, Object> s : stations) {
            String key = String.valueOf(s.get("stationId"));
            Map<String, Object> item = businessRow(byStation.get(key));
            item.put("stationId", s.get("stationId"));
            item.put("tenantId", s.get("tenantId"));
            item.put("name", s.get("stationName"));
            long deviceCount = 0;
            for (Map<String, Object> p : pileGroups)
                if (key.equals(String.valueOf(p.get("stationId")))
                        && String.valueOf(s.get("tenantId"))
                                .equals(String.valueOf(p.get("tenantId"))))
                    deviceCount += Long.parseLong(p.get("deviceCount").toString());
            item.put("deviceCount", deviceCount);
            stationStats.add(item);
        }
        stationStats.sort(
                (a, b) -> {
                    int comparison =
                            new BigDecimal(b.get("revenue").toString())
                                    .compareTo(new BigDecimal(a.get("revenue").toString()));
                    return comparison != 0
                            ? comparison
                            : Long.compare(
                                    Long.parseLong(a.get("stationId").toString()),
                                    Long.parseLong(b.get("stationId").toString()));
                });
        result.put("stationStats", stationStats);
        List<Map<String, Object>> ranking = new ArrayList<>();
        for (Map<String, Object> s : stationStats)
            if (Long.parseLong(s.get("count").toString()) > 0 && ranking.size() < 8) ranking.add(s);
        result.put("ranking", ranking);
        args = new ArrayList<>();
        orderWhere =
                tenant("o", selected, args) + station(stationId, args) + period(start, end, args);
        Map<String, Map<String, Object>> byOperator =
                index(queries.listOperatorOrders(orderWhere, args), "tenantId");
        List<Map<String, Object>> operatorStats = new ArrayList<>();
        for (Map<String, Object> operator : operators) {
            Object id = operator.get("id");
            if (selected != null && !String.valueOf(id).equals(String.valueOf(selected))) continue;
            Map<String, Object> item = businessRow(byOperator.get(String.valueOf(id)));
            item.put("tenantId", id);
            item.put("name", operator.get("name"));
            item.put(
                    "stationCount",
                    stations.stream()
                            .filter(
                                    s ->
                                            String.valueOf(id)
                                                    .equals(String.valueOf(s.get("tenantId"))))
                            .count());
            long deviceCount = 0;
            for (Map<String, Object> p : pileGroups)
                if (String.valueOf(id).equals(String.valueOf(p.get("tenantId"))))
                    deviceCount += Long.parseLong(p.get("deviceCount").toString());
            item.put("deviceCount", deviceCount);
            operatorStats.add(item);
        }
        operatorStats.sort(
                (a, b) ->
                        new BigDecimal(b.get("revenue").toString())
                                .compareTo(new BigDecimal(a.get("revenue").toString())));
        result.put("operatorStats", operatorStats);
    }

    private void addAlerts(
            Map<String, Object> result,
            FaultTicketService.Scope identity,
            Long selected,
            Long stationId) {
        List<Object> args;
        Set<String> permissions = SecurityUtils.getLoginUser().getPermissions();
        boolean canFault =
                identity.root
                        || (permissions != null
                                && (permissions.contains("*:*:*")
                                        || permissions.contains("operator:fault:list")));
        result.put("canFault", canFault);
        boolean canPile =
                identity.root
                        || (permissions != null
                                && (permissions.contains("*:*:*")
                                        || permissions.contains("operator:pile:list")));
        result.put("offlineDevices", Collections.emptyList());
        result.put("pendingFaults", Collections.emptyList());
        result.put("actionSummary", Collections.emptyMap());
        if (canPile) {
            args = new ArrayList<>();
            String offlineWhere = tenant("p", selected, args) + station(stationId, args);
            result.put("actionSummary", queries.summarizeOfflineDevices(offlineWhere, args));
            result.put("offlineDevices", queries.listOfflineDevices(offlineWhere, args));
        }
        result.put("alarms", Collections.emptyList());
        result.put("faultSummary", Collections.emptyMap());
        if (canFault) {
            args = new ArrayList<>();
            String alarmWhere = tenant("a", selected, args) + station(stationId, args);
            result.put("alarms", queries.listDeviceAlarms(alarmWhere, args));
            args = new ArrayList<>();
            String faultWhere = tenant("t", selected, args) + station(stationId, args);
            result.put("faultSummary", queries.summarizeFaults(faultWhere, args));
            result.put("pendingFaults", queries.listPendingFaults(faultWhere, args));
        }
    }

    private String tenant(String alias, Long tenant, List<Object> args) {
        if (tenant == null) return "";
        args.add(tenant);
        return " AND " + alias + ".tenant_id=?";
    }

    private String station(Long station, List<Object> args) {
        if (station == null) return "";
        args.add(station);
        return " AND s.station_id=?";
    }

    private String period(LocalDate start, LocalDate end, List<Object> args) {
        if (start == null) return "";
        args.add(start.toString());
        args.add(end.plusDays(1).toString());
        return " AND o.create_time>=? AND o.create_time<?";
    }

    private Map<String, Map<String, Object>> index(List<Map<String, Object>> rows, String key) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) result.put(String.valueOf(row.get(key)), row);
        return result;
    }

    private Map<String, Object> businessRow(Map<String, Object> source) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("revenue", BigDecimal.ZERO);
        row.put("power", BigDecimal.ZERO);
        row.put("count", 0);
        row.put("activeDeviceCount", 0);
        if (source != null) row.putAll(source);
        return row;
    }
}
