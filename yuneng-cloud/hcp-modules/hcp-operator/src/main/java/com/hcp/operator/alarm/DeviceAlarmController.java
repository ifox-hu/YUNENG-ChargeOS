package com.hcp.operator.alarm;

import com.hcp.common.core.domain.R;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.operator.service.FaultTicketService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/fault/alarms")
public class DeviceAlarmController {
    private final DeviceAlarmEventService events;private final FaultTicketService tickets;
    public DeviceAlarmController(DeviceAlarmEventService events,FaultTicketService tickets){this.events=events;this.tickets=tickets;}
    @PostMapping @RequiresPermissions("operator:fault:add")
    public R<Map<String,Object>> accept(@RequestBody DeviceAlarmRequest request){return R.ok(events.accept(request,tickets.operator()));}
    @GetMapping @RequiresPermissions("operator:fault:list")
    public R<Map<String,Object>> list(@RequestParam(required=false)String status,@RequestParam(required=false)String pileId,
        @RequestParam(defaultValue="1")int pageNum,@RequestParam(defaultValue="10")int pageSize){return R.ok(events.list(tickets.operator(),status,pileId,pageNum,pageSize));}
    @GetMapping("/{id}") @RequiresPermissions("operator:fault:list")
    public R<Map<String,Object>> detail(@PathVariable long id){return R.ok(events.detail(id,tickets.operator()));}
    @PostMapping("/{id}/replay") @RequiresPermissions("operator:fault:alarm-replay")
    public R<Map<String,Object>> replay(@PathVariable long id){return R.ok(events.replay(id,tickets.operator()));}
}
