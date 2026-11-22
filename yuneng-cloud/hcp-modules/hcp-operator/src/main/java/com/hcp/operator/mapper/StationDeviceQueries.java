package com.hcp.operator.mapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public class StationDeviceQueries
{
    private static final String PILE_SCOPE =
        " WHERE p.station_id=? AND p.tenant_id=? AND COALESCE(p.deleted,0)=0";
    private static final String CAR_RATE =
        " WHERE tenant_id=? AND device_type=4 AND rule_type='10002'";

    private final JdbcTemplate jdbc;

    public StationDeviceQueries(JdbcTemplate jdbc)
    {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> station(Long stationId, Long tenant, boolean lock)
    {
        String sql = "SELECT CAST(station_id AS CHAR) AS stationId,tenant_id AS tenantId,station_name AS stationName," +
            " station_code AS stationCode,address,device_type AS deviceType FROM c_charging_station" +
            " WHERE station_id=? AND COALESCE(del_flag,0)=0 AND tenant_id IS NOT NULL";
        String lockClause = lock ? " FOR UPDATE" : "";
        return tenant == null ? jdbc.queryForList(sql + lockClause, stationId)
            : jdbc.queryForList(sql + " AND tenant_id=?" + lockClause, stationId, tenant);
    }

    public List<Map<String, Object>> piles(Long stationId, Long tenant)
    {
        return jdbc.queryForList(
            "SELECT p.pile_id AS pileId,p.name,p.running_status AS runningStatus,p.pile_status AS pileStatus," +
            " p.wx_rule_id AS wxRuleId,r.change_name AS rateName," +
            " DATE_FORMAT(COALESCE(h.update_time,h.create_time),'%Y-%m-%d %H:%i:%s') AS lastHeartbeat" +
            " FROM c_charging_pile p LEFT JOIN c_heartbeat h ON h.pile_id=p.pile_id AND h.tenant_id=p.tenant_id" +
            " LEFT JOIN c_rule r ON r.id=p.wx_rule_id AND r.tenant_id=p.tenant_id AND r.device_type=p.device_type" +
            " AND r.rule_type='10002'" + PILE_SCOPE + " ORDER BY p.pile_id",
            stationId, tenant);
    }

    public List<Map<String, Object>> guns(Long stationId, Long tenant)
    {
        return jdbc.queryForList(
            "SELECT g.pile_id AS pileId,CAST(g.port_id AS CHAR) AS portId,g.name,g.device_id AS deviceId," +
            " g.state,g.gun_status AS gunStatus,g.can_use AS canUse,g.gun_insert AS gunInsert,g.fault_reason AS faultReason" +
            " FROM c_charging_port g JOIN c_charging_pile p ON p.pile_id=g.pile_id AND p.tenant_id=g.tenant_id" +
            PILE_SCOPE + " ORDER BY g.port_id",
            stationId, tenant);
    }

    public List<Map<String, Object>> rates(Long tenant)
    {
        return jdbc.queryForList("SELECT id,change_name AS changeName FROM c_rule" + CAR_RATE +
            " ORDER BY change_name,id", tenant);
    }

    public boolean lockRate(Long tenant, Long rateId)
    {
        return !jdbc.queryForList("SELECT id FROM c_rule" + CAR_RATE + " AND id=? FOR UPDATE", tenant, rateId).isEmpty();
    }
}
