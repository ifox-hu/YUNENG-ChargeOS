package com.hcp.operator.alarm;

import com.hcp.common.core.exception.ServiceException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import lombok.Data;

/** A stable source event identity must be reused on client retries. */
@Data
public class DeviceAlarmRequest {
    private String eventId, pileId, faultType, priority, description, occurredAt;

    public DeviceAlarmRequest normalized() {
        DeviceAlarmRequest r=new DeviceAlarmRequest();
        r.eventId=text(eventId,64,"告警事件编号");
        if(!r.eventId.matches("[A-Za-z0-9_.:-]+")) throw new ServiceException("告警事件编号格式不合法");
        r.pileId=text(pileId,64,"设备编号");
        r.faultType=text(faultType,24,"故障类型");
        if(!Arrays.asList("OFFLINE","CONNECTOR","POWER","OTHER").contains(r.faultType))
            throw new ServiceException("故障类型不合法");
        r.priority=priority==null?"NORMAL":text(priority,16,"优先级");
        if(!Arrays.asList("LOW","NORMAL","HIGH").contains(r.priority)) throw new ServiceException("优先级不合法");
        r.description=text(description,1000,"故障描述");
        try { r.occurredAt=OffsetDateTime.parse(text(occurredAt,64,"告警时间"))
                .toInstant().truncatedTo(ChronoUnit.MILLIS).toString(); }
        catch(ServiceException ex) { throw ex; }
        catch(Exception ex) { throw new ServiceException("告警时间须为含时区的ISO8601格式"); }
        return r;
    }

    private static String text(String value,int max,String label) {
        if(value==null || value.trim().isEmpty() || value.trim().length()>max)
            throw new ServiceException(label+"不能为空且不能超过"+max+"字");
        return value.trim();
    }
}
