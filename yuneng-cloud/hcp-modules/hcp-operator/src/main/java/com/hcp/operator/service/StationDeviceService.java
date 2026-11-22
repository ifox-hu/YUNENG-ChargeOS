package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.operator.domain.StationDeviceRequest;
import com.hcp.operator.mapper.StationDeviceQueries;
import com.hcp.operator.rule.OperatorResourceScope;
import com.hcp.system.api.domain.ChargingPile;
import com.hcp.system.api.domain.ChargingPort;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StationDeviceService
{
    private final StationDeviceQueries queries;
    private final OperatorResourceScope scope;
    private final FaultTicketService identities;
    private final IChargingPileService piles;
    private final IChargingPortService ports;

    public StationDeviceService(StationDeviceQueries queries, OperatorResourceScope scope, FaultTicketService identities,
                                IChargingPileService piles, IChargingPortService ports)
    {
        this.queries = queries;
        this.scope = scope;
        this.identities = identities;
        this.piles = piles;
        this.ports = ports;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> devices(Long stationId, Long requestedTenant)
    {
        FaultTicketService.Scope identity = identities.operator();
        if (!identity.root)
            scope.bind(requestedTenant);
        Map<String, Object> station = station(stationId, identity.root ? requestedTenant : identity.tenant, false);
        Long tenant = ((Number) station.get("tenantId")).longValue();
        List<Map<String, Object>> devices = queries.piles(stationId, tenant);
        Map<String, List<Map<String, Object>>> byPile = new HashMap<>();
        List<Map<String, Object>> guns = queries.guns(stationId, tenant);
        for (Map<String, Object> gun : guns)
            byPile.computeIfAbsent((String) gun.get("pileId"), key -> new ArrayList<>()).add(gun);
        for (Map<String, Object> device : devices)
            device.put("ports", byPile.getOrDefault(device.get("pileId"), Collections.emptyList()));
        station.put("tenantId", tenant.toString());
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("station", station);
        snapshot.put("piles", devices);
        snapshot.put("canManage", tenant.equals(identity.tenant) && Integer.valueOf(4).equals(station.get("deviceType")));
        return snapshot;
    }

    public List<Map<String, Object>> rates(Long stationId)
    {
        Long tenant = scope.bind(null);
        requireCarStation(station(stationId, tenant, false));
        return queries.rates(tenant);
    }

    @Transactional(rollbackFor = Exception.class)
    public String add(Long stationId, StationDeviceRequest input)
    {
        Long tenant = scope.bind(null);
        requireCarStation(station(stationId, tenant, true));
        String pileId = input.getPileId() == null ? "" : input.getPileId().trim();
        String name = input.getName() == null ? "" : input.getName().trim();
        if (!pileId.matches("[A-Za-z0-9_-]{1,64}") || name.isEmpty() || name.length() > 64)
            throw new ServiceException("请填写有效的桩编号和名称");
        if (input.getGunCount() == null || input.getGunCount() < 1 || input.getGunCount() > 8 ||
            input.getPileType() == null || (input.getPileType() != 0 && input.getPileType() != 1))
            throw new ServiceException("请选择充电桩类型并填写 1 至 8 个枪口");
        if (!positive(input.getVoltage()) || !positive(input.getElectricity()) ||
            input.getMaxPower() == null || input.getMaxPower() < 1 || input.getMaxPower() > Integer.MAX_VALUE)
            throw new ServiceException("请填写有效的额定电压、电流和功率");
        if (input.getWxRuleId() == null || !queries.lockRate(tenant, input.getWxRuleId()))
            throw new ServiceException("请选择本运营商的汽车充电费率");

        ChargingPile pile = new ChargingPile();
        pile.setPileId(pileId);
        pile.setName(name);
        pile.setStationId(stationId);
        pile.setTenantId(tenant);
        pile.setUserId(SecurityUtils.getUserId());
        pile.setDeviceType(4L);
        pile.setPileType(input.getPileType());
        pile.setRunningStatus(1L);
        pile.setDeleted(0);
        pile.setWxRuleId(input.getWxRuleId());
        pile.setVoltage(input.getVoltage());
        pile.setElectricity(input.getElectricity());
        pile.setMaxPower(input.getMaxPower());
        try
        {
            if (piles.insertChargingPile(pile) != 1)
                throw new ServiceException("充电桩创建失败");
        }
        catch (DuplicateKeyException duplicate)
        {
            throw new ServiceException("桩编号已存在");
        }

        for (int number = 1; number <= input.getGunCount(); number++)
        {
            ChargingPort port = new ChargingPort();
            port.setTenantId(tenant);
            port.setPileId(pileId);
            port.setDeviceId(String.valueOf(number));
            port.setName(number + " 号枪");
            port.setState("N");
            port.setGunStatus(0L);
            port.setCanUse(0L);
            if (ports.insertChargingPort(port) != 1)
                throw new ServiceException("枪口创建失败");
        }
        return pileId;
    }

    private Map<String, Object> station(Long stationId, Long tenant, boolean lock)
    {
        List<Map<String, Object>> rows = queries.station(stationId, tenant, lock);
        if (rows.isEmpty())
            throw new ServiceException("站点不存在或无权查看", 404);
        return rows.get(0);
    }

    private void requireCarStation(Map<String, Object> station)
    {
        if (!Integer.valueOf(4).equals(station.get("deviceType")))
            throw new ServiceException("请在汽车充电站添加设备");
    }

    private boolean positive(String value)
    {
        return value != null && value.matches("[0-9]{1,7}(\\.[0-9]{1,3})?") && new BigDecimal(value).signum() > 0;
    }
}
