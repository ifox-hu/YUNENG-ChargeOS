package com.hcp.operator.controller;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.core.web.domain.AjaxResult;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.operator.service.FaultTicketService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Read-only dashboard aggregate. Tenant identity is taken exclusively from the session. */
@RestController
@RequestMapping("/overview")
public class OperationsOverviewController {
    private final JdbcTemplate jdbc;
    private final FaultTicketService tickets;
    public OperationsOverviewController(JdbcTemplate jdbc, FaultTicketService tickets) { this.jdbc=jdbc; this.tickets=tickets; }

    private String tenant(String alias, Long tenant, List<Object> args) {
        if (tenant==null) return "";
        args.add(tenant);
        return " AND "+alias+".tenant_id=?";
    }
    private String station(Long station, List<Object> args) {
        if (station==null) return "";
        args.add(station);
        return " AND s.station_id=?";
    }
    private List<Map<String,Object>> rows(String sql,List<Object> args) { return jdbc.queryForList(sql,args.toArray()); }
    private Map<String,Object> one(String sql,List<Object> args) { return rows(sql,args).get(0); }
    private String period(LocalDate start,LocalDate end,List<Object> args) {
        if(start==null) return "";
        args.add(start.toString());args.add(end.plusDays(1).toString());
        return " AND o.create_time>=? AND o.create_time<?";
    }
    private Map<String,Map<String,Object>> index(List<Map<String,Object>> rows,String key) {
        Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(Map<String,Object> row:rows) result.put(String.valueOf(row.get(key)),row);
        return result;
    }
    private Map<String,Object> businessRow(Map<String,Object> source) {
        Map<String,Object> row=new LinkedHashMap<>();
        row.put("revenue",BigDecimal.ZERO);row.put("power",BigDecimal.ZERO);row.put("count",0);row.put("activeDeviceCount",0);
        if(source!=null) row.putAll(source);
        return row;
    }

    @GetMapping
    @RequiresPermissions("operator:station:list")
    @Transactional(readOnly=true)
    public AjaxResult get(@RequestParam(required=false) Long tenantId,@RequestParam(required=false) Long stationId,
                         @RequestParam(required=false) String startDate,@RequestParam(required=false) String endDate) {
        FaultTicketService.Scope identity=tickets.operator();
        LocalDate start=null,end=null;
        if(startDate!=null || endDate!=null) {
            try {
                if(startDate==null || endDate==null || !startDate.matches("\\d{4}-\\d{2}-\\d{2}") || !endDate.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
                start=LocalDate.parse(startDate);end=LocalDate.parse(endDate);
                if(end.isBefore(start) || ChronoUnit.DAYS.between(start,end)>365) throw new IllegalArgumentException();
            } catch(RuntimeException invalid) { throw new ServiceException("请选择有效日期范围，最多366天",400); }
        }
        if (!identity.root && tenantId!=null && !tenantId.equals(identity.tenant)) throw new ServiceException("无权查看其他运营商",403);
        Long selected=identity.root?tenantId:identity.tenant;
        List<Object> args=new ArrayList<>();
        List<Map<String,Object>> operators=rows("SELECT id,tenant_name AS name FROM sys_tenant t WHERE COALESCE(t.del_flag,'0')='0'"
            +(identity.root?"":tenant("t",identity.tenant,args).replace("t.tenant_id","t.id"))+" ORDER BY id",args);
        // Keep historical data attributable when an old tenant no longer has a registry row.
        if(identity.root) for(Map<String,Object> row:jdbc.queryForList("SELECT DISTINCT tenant_id AS id FROM c_charging_station WHERE tenant_id IS NOT NULL AND COALESCE(del_flag,0)=0 UNION SELECT DISTINCT tenant_id AS id FROM c_charging_order WHERE tenant_id IS NOT NULL")) {
            if(operators.stream().noneMatch(o->String.valueOf(o.get("id")).equals(String.valueOf(row.get("id"))))) {
                row.put("name","运营商 #"+row.get("id")); operators.add(row);
            }
        }
        if (selected!=null && identity.root && operators.stream().noneMatch(o->String.valueOf(o.get("id")).equals(String.valueOf(selected)))) throw new ServiceException("运营商不存在",404);
        args=new ArrayList<>();
        List<Map<String,Object>> options=rows("SELECT s.station_id AS stationId,s.station_name AS stationName,s.tenant_id AS tenantId,s.address,s.region_code AS regionCode,s.province,s.city,s.lat,s.lng FROM c_charging_station s WHERE COALESCE(s.del_flag,0)=0"+tenant("s",selected,args)+" ORDER BY s.station_id",args);
        if(stationId!=null && options.stream().noneMatch(s->String.valueOf(s.get("stationId")).equals(String.valueOf(stationId)))) throw new ServiceException("站点不存在或不属于当前运营商",403);
        List<Map<String,Object>> stations=new ArrayList<>();
        for(Map<String,Object> s:options) if(stationId==null || String.valueOf(s.get("stationId")).equals(String.valueOf(stationId))) stations.add(s);
        Map<String,Object> result=new LinkedHashMap<>(),scope=new LinkedHashMap<>();
        scope.put("root",identity.root);scope.put("tenantId",selected);scope.put("stationId",stationId);
        result.put("scope",scope);result.put("operators",operators);result.put("stationOptions",options);result.put("stations",stations);

        String join=" FROM c_charging_order o LEFT JOIN c_charging_pile p ON p.pile_id=o.pile_id AND p.tenant_id=o.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1";
        args=new ArrayList<>();String orderWhere=tenant("o",selected,args)+station(stationId,args)+period(start,end,args);
        // Matches existing financial states; use exact station identity, never fuzzy station name.
        String sales="COALESCE(SUM(CASE WHEN o.order_state IN ('3','4','5','6','7') THEN CAST(COALESCE(NULLIF(o.ordergold,''),'0') AS DECIMAL(18,6)) ELSE 0 END),0)";
        String refund="COALESCE(SUM(CASE WHEN o.order_state='4' THEN o.refund_amount ELSE 0 END),0)";
        Map<String,Object> summary=one("SELECT "+sales+" AS sumSales,"+refund+" AS reSales,COALESCE(SUM(o.consume_power),0) AS consumePower,COUNT(*) AS chargeTimes"+join+orderWhere,args);
        summary.put("realSales",new BigDecimal(summary.get("sumSales").toString()).subtract(new BigDecimal(summary.get("reSales").toString())));
        Map<String,Object> periodComparison=new LinkedHashMap<>();periodComparison.put("available",start!=null);
        if(start!=null) {
            long length=ChronoUnit.DAYS.between(start,end)+1;
            LocalDate previousEnd=start.minusDays(1),previousStart=start.minusDays(length);
            List<Object> previousArgs=new ArrayList<>();
            String previousWhere=tenant("o",selected,previousArgs)+station(stationId,previousArgs)+period(previousStart,previousEnd,previousArgs);
            Map<String,Object> previous=one("SELECT "+sales+"-"+refund+" AS realSales,COUNT(*) AS chargeTimes,COALESCE(SUM(o.consume_power),0) AS consumePower"+join+previousWhere,previousArgs);
            Map<String,Object> previousPeriod=new LinkedHashMap<>();previousPeriod.put("startDate",previousStart.toString());previousPeriod.put("endDate",previousEnd.toString());
            periodComparison.put("period",previousPeriod);periodComparison.put("summary",previous);
        }
        result.put("comparison",periodComparison);
        // These aggregates use the exact same order scope and date boundaries as the KPI totals.
        List<Map<String,Object>> hourGroups=rows("SELECT HOUR(o.create_time) AS hour,COUNT(*) AS count,COALESCE(SUM(o.consume_power),0) AS power"+join+orderWhere+" GROUP BY HOUR(o.create_time)",args);
        Map<String,Map<String,Object>> hoursByKey=index(hourGroups,"hour");List<Map<String,Object>> hourly=new ArrayList<>();
        for(int hour=0;hour<24;hour++) {Map<String,Object> item=new LinkedHashMap<>();item.put("hour",hour);item.put("count",0);item.put("power",0);if(hoursByKey.containsKey(String.valueOf(hour)))item.putAll(hoursByKey.get(String.valueOf(hour)));hourly.add(item);}
        result.put("hourly",hourly);
        Map<String,Map<String,Object>> states=index(rows("SELECT COALESCE(o.order_state,'unknown') AS state,COUNT(*) AS count"+join+orderWhere+" GROUP BY o.order_state",args),"state");
        String[] stateNames={"下单","取消","支付成功","退款","完成","结算中","手动结算"};List<Map<String,Object>> stateRows=new ArrayList<>();
        for(int i=0;i<stateNames.length;i++) {String key=String.valueOf(i+1);Map<String,Object> item=new LinkedHashMap<>();item.put("state",key);item.put("name",stateNames[i]);item.put("count",states.containsKey(key)?states.remove(key).get("count"):0);stateRows.add(item);}
        long otherCount=0;for(Map<String,Object> item:states.values())otherCount+=((Number)item.get("count")).longValue();
        Map<String,Object> other=new LinkedHashMap<>();other.put("state","unknown");other.put("name","其他/未识别");other.put("count",otherCount);stateRows.add(other);
        Map<String,Object> quality=new LinkedHashMap<>();quality.put("states",stateRows);quality.put("refundCount",stateRows.get(3).get("count"));quality.put("refundAmount",summary.get("reSales"));quality.put("cancelledCount",stateRows.get(1).get("count"));result.put("orderQuality",quality);
        args=new ArrayList<>();String pileWhere=tenant("p",selected,args)+station(stationId,args);
        summary.putAll(one("SELECT COUNT(*) AS totalNumbers,COALESCE(SUM(p.running_status=0),0) AS onLine,COALESCE(SUM(p.running_status=1),0) AS offLine,COALESCE(SUM(p.running_status IS NULL OR p.running_status NOT IN(0,1)),0) AS unknownState FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0"+pileWhere,args));
        summary.put("stationTotal",stations.size());result.put("summary",summary);
        LocalDate today=jdbc.queryForObject("SELECT CURDATE()",java.sql.Date.class).toLocalDate();
        LocalDate trendStart=start==null?today.minusDays(29):start,trendEnd=end==null?today:end;
        Map<String,Object> dateRange=new LinkedHashMap<>();dateRange.put("startDate",trendStart.toString());dateRange.put("endDate",trendEnd.toString());dateRange.put("filtered",start!=null);result.put("period",dateRange);
        args=new ArrayList<>();orderWhere=tenant("o",selected,args)+station(stationId,args)+period(trendStart,trendEnd,args);
        List<Map<String,Object>> days=rows("SELECT DATE_FORMAT(o.create_time,'%Y-%m-%d') AS day,"+sales+"-"+refund+" AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count"+join+orderWhere+" GROUP BY DATE_FORMAT(o.create_time,'%Y-%m-%d') ORDER BY day",args);
        List<Map<String,Object>> trend=new ArrayList<>();
        for(LocalDate date=trendStart;!date.isAfter(trendEnd);date=date.plusDays(1)){String day=date.toString();Map<String,Object> item=new LinkedHashMap<>();item.put("day",day);item.put("revenue",0);item.put("power",0);item.put("count",0);for(Map<String,Object> d:days)if(day.equals(d.get("day")))item.putAll(d);trend.add(item);}
        result.put("trend",trend);
        args=new ArrayList<>();orderWhere=tenant("o",selected,args)+station(stationId,args)+period(start,end,args);
        String activeDevices="COUNT(DISTINCT CASE WHEN COALESCE(p.deleted,0)=0 THEN p.pile_id ELSE NULL END) AS activeDeviceCount";
        List<Map<String,Object>> stationOrders=rows("SELECT s.station_id AS stationId,"+sales+"-"+refund+" AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count,"+activeDevices+join+orderWhere+" AND s.station_id IS NOT NULL GROUP BY s.station_id",args);
        Map<String,Map<String,Object>> byStation=index(stationOrders,"stationId");
        args=new ArrayList<>();pileWhere=tenant("p",selected,args)+station(stationId,args);
        List<Map<String,Object>> pileGroups=rows("SELECT p.station_id AS stationId,p.tenant_id AS tenantId,COUNT(*) AS deviceCount FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0"+pileWhere+" GROUP BY p.station_id,p.tenant_id",args);
        List<Map<String,Object>> stationStats=new ArrayList<>();
        for(Map<String,Object> s:stations) {
            String key=String.valueOf(s.get("stationId"));Map<String,Object> item=businessRow(byStation.get(key));
            item.put("stationId",s.get("stationId"));item.put("tenantId",s.get("tenantId"));item.put("name",s.get("stationName"));
            long deviceCount=0;for(Map<String,Object> p:pileGroups)if(key.equals(String.valueOf(p.get("stationId"))) && String.valueOf(s.get("tenantId")).equals(String.valueOf(p.get("tenantId"))))deviceCount+=Long.parseLong(p.get("deviceCount").toString());
            item.put("deviceCount",deviceCount);stationStats.add(item);
        }
        stationStats.sort((a,b)->{int comparison=new BigDecimal(b.get("revenue").toString()).compareTo(new BigDecimal(a.get("revenue").toString()));return comparison!=0?comparison:Long.compare(Long.parseLong(a.get("stationId").toString()),Long.parseLong(b.get("stationId").toString()));});
        result.put("stationStats",stationStats);
        List<Map<String,Object>> ranking=new ArrayList<>();for(Map<String,Object> s:stationStats)if(Long.parseLong(s.get("count").toString())>0 && ranking.size()<8)ranking.add(s);result.put("ranking",ranking);
        args=new ArrayList<>();orderWhere=tenant("o",selected,args)+station(stationId,args)+period(start,end,args);
        Map<String,Map<String,Object>> byOperator=index(rows("SELECT o.tenant_id AS tenantId,"+sales+"-"+refund+" AS revenue,COALESCE(SUM(o.consume_power),0) AS power,COUNT(*) AS count,"+activeDevices+join+orderWhere+" GROUP BY o.tenant_id",args),"tenantId");
        List<Map<String,Object>> operatorStats=new ArrayList<>();
        for(Map<String,Object> operator:operators) {
            Object id=operator.get("id");if(selected!=null && !String.valueOf(id).equals(String.valueOf(selected)))continue;
            Map<String,Object> item=businessRow(byOperator.get(String.valueOf(id)));item.put("tenantId",id);item.put("name",operator.get("name"));
            item.put("stationCount",stations.stream().filter(s->String.valueOf(id).equals(String.valueOf(s.get("tenantId")))).count());
            long deviceCount=0;for(Map<String,Object> p:pileGroups)if(String.valueOf(id).equals(String.valueOf(p.get("tenantId"))))deviceCount+=Long.parseLong(p.get("deviceCount").toString());item.put("deviceCount",deviceCount);operatorStats.add(item);
        }
        operatorStats.sort((a,b)->new BigDecimal(b.get("revenue").toString()).compareTo(new BigDecimal(a.get("revenue").toString())));result.put("operatorStats",operatorStats);

        Set<String> permissions=SecurityUtils.getLoginUser().getPermissions();
        boolean canFault=identity.root || (permissions!=null && (permissions.contains("*:*:*") || permissions.contains("operator:fault:list")));
        result.put("canFault",canFault);
        boolean canPile=identity.root || (permissions!=null && (permissions.contains("*:*:*") || permissions.contains("operator:pile:list")));
        result.put("offlineDevices",Collections.emptyList());result.put("pendingFaults",Collections.emptyList());result.put("actionSummary",Collections.emptyMap());
        if(canPile) {
            args=new ArrayList<>();String offlineWhere=tenant("p",selected,args)+station(stationId,args);
            String offlineFrom=" FROM c_charging_pile p LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE COALESCE(p.deleted,0)=0 AND p.running_status=1"+offlineWhere;
            result.put("actionSummary",one("SELECT COALESCE(SUM(p.offline_time<=DATE_SUB(NOW(),INTERVAL 24 HOUR)),0) AS offline24Count,COALESCE(SUM(p.offline_time IS NULL OR p.offline_time>NOW()),0) AS offlineUnknownCount"+offlineFrom,args));
            result.put("offlineDevices",rows("SELECT p.pile_id AS pileId,p.name,s.station_name AS stationName,p.offline_time AS offlineTime,CASE WHEN p.offline_time<=NOW() THEN TIMESTAMPDIFF(MINUTE,p.offline_time,NOW()) ELSE NULL END AS offlineMinutes"+offlineFrom+" ORDER BY p.offline_time IS NULL,p.offline_time ASC,p.pile_id LIMIT 20",args));
        }
        result.put("alarms",Collections.emptyList());result.put("faultSummary",Collections.emptyMap());
        if(canFault){
            args=new ArrayList<>();String alarmWhere=tenant("a",selected,args)+station(stationId,args);
            result.put("alarms",rows("SELECT a.id,a.description,a.pile_id AS pileId,a.occurred_at AS occurredAt,a.received_at AS receivedAt,a.priority FROM c_device_alarm_event a LEFT JOIN c_charging_pile p ON p.pile_id=a.pile_id AND p.tenant_id=a.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1"+alarmWhere+" ORDER BY a.received_at DESC,a.id DESC LIMIT 6",args));
            args=new ArrayList<>();String faultWhere=tenant("t",selected,args)+station(stationId,args);
            result.put("faultSummary",one("SELECT COALESCE(SUM(t.status<>'CLOSED'),0) AS active,COALESCE(SUM(t.status='CLOSED'),0) AS closed,COALESCE(SUM(t.status='NEW'),0) AS pending,COALESCE(SUM(t.status='RESOLVED'),0) AS resolved FROM c_fault_ticket t LEFT JOIN c_charging_pile p ON p.pile_id=t.pile_id AND p.tenant_id=t.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE 1=1"+faultWhere,args));
            result.put("pendingFaults",rows("SELECT t.id,t.ticket_no AS ticketNo,t.pile_id AS pileId,t.status,t.description,t.created_at AS createdAt,CASE WHEN t.created_at<=NOW() THEN TIMESTAMPDIFF(MINUTE,t.created_at,NOW()) ELSE NULL END AS ageMinutes,s.station_name AS stationName FROM c_fault_ticket t LEFT JOIN c_charging_pile p ON p.pile_id=t.pile_id AND p.tenant_id=t.tenant_id LEFT JOIN c_charging_station s ON s.station_id=p.station_id AND s.tenant_id=p.tenant_id WHERE t.status<>'CLOSED'"+faultWhere+" ORDER BY t.created_at ASC,t.id ASC LIMIT 20",args));
        }
        return AjaxResult.success(result);
    }
}
