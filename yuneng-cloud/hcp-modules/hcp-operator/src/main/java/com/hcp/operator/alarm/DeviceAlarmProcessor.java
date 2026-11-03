package com.hcp.operator.alarm;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.service.FaultTicketService;
import com.hcp.system.api.domain.FaultRequest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Separate proxied bean: ticket, alarm, log and processing receipt commit together. */
@Service
public class DeviceAlarmProcessor {
    public static class UnknownEventException extends RuntimeException {
        public UnknownEventException(){super("未知告警事件");}
    }
    private final JdbcTemplate jdbc;private final FaultTicketService tickets;
    public DeviceAlarmProcessor(JdbcTemplate jdbc,FaultTicketService tickets){this.jdbc=jdbc;this.tickets=tickets;}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    @SuppressWarnings("unchecked")
    public void process(long id){
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT * FROM c_device_alarm_event WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new UnknownEventException();
        Map<String,Object> e=rows.get(0);
        if("PROCESSED".equals(e.get("status"))||"DEAD".equals(e.get("status")))return;
        FaultRequest r=new FaultRequest();r.setPileId((String)e.get("pile_id"));r.setFaultType((String)e.get("fault_type"));
        r.setPriority((String)e.get("priority"));r.setDescription((String)e.get("description"));
        Map<String,Object> result=tickets.createDeviceAlarm(r,((Number)e.get("tenant_id")).longValue(),
            ((Number)e.get("actor_id")).longValue(),(String)e.get("actor_name"),"ALARM-"+id);
        Number ticket=(Number)((Map<String,Object>)result.get("ticket")).get("id");
        jdbc.update("UPDATE c_device_alarm_event SET status='PROCESSED',ticket_id=?,processed_at=NOW(3),lease_token=NULL,last_error=NULL WHERE id=?",ticket.longValue(),id);
    }
}
