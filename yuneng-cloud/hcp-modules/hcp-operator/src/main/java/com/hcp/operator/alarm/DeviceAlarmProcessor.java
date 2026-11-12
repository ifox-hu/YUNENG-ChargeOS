package com.hcp.operator.alarm;

import com.hcp.operator.service.FaultTicketService;
import com.hcp.system.api.domain.FaultRequest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/**
 * 告警处理：工单、告警记录、日志和处理结果在同一事务内提交。
 */
@Service
public class DeviceAlarmProcessor
{
    public static class UnknownEventException extends RuntimeException
    {
        public UnknownEventException()
        {
            super("未知告警事件");
        }
    }

    private final JdbcTemplate jdbc;
    private final FaultTicketService tickets;

    public DeviceAlarmProcessor(JdbcTemplate jdbc, FaultTicketService tickets)
    {
        this.jdbc = jdbc;
        this.tickets = tickets;
    }

    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    @SuppressWarnings("unchecked")
    public void process(long id)
    {
        List<Map<String, Object>> rows =
            jdbc.queryForList("SELECT * FROM c_device_alarm_event WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty())
            throw new UnknownEventException();
        Map<String, Object> event = rows.get(0);
        if ("PROCESSED".equals(event.get("status")) || "DEAD".equals(event.get("status")))
            return;
        FaultRequest request = new FaultRequest();
        request.setPileId((String)event.get("pile_id"));
        request.setFaultType((String)event.get("fault_type"));
        request.setPriority((String)event.get("priority"));
        request.setDescription((String)event.get("description"));
        Map<String, Object> result = tickets.createDeviceAlarm(request, ((Number)event.get("tenant_id")).longValue(),
                ((Number)event.get("actor_id")).longValue(), (String)event.get("actor_name"), "ALARM-" + id);
        Number ticketId = (Number)((Map<String, Object>)result.get("ticket")).get("id");
        jdbc.update(
            "UPDATE c_device_alarm_event SET status='PROCESSED',ticket_id=?,processed_at=NOW(3),lease_token=NULL,last_error=NULL WHERE id=?",
            ticketId.longValue(), id);
    }
}
