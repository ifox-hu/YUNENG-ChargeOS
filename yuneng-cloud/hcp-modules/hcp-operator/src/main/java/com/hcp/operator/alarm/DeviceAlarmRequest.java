package com.hcp.operator.alarm;

import com.hcp.common.core.exception.ServiceException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import lombok.Data;

/**
 * 设备告警请求；客户端重试时须复用同一事件编号。
 */
@Data
public class DeviceAlarmRequest
{
    private String eventId, pileId, faultType, priority, description, occurredAt;

    public DeviceAlarmRequest normalized()
    {
        DeviceAlarmRequest request = new DeviceAlarmRequest();
        request.eventId = text(eventId, 64, "告警事件编号");
        if (!request.eventId.matches("[A-Za-z0-9_.:-]+"))
            throw new ServiceException("告警事件编号格式不合法");
        request.pileId = text(pileId, 64, "设备编号");
        request.faultType = text(faultType, 24, "故障类型");
        if (!Arrays.asList("OFFLINE", "CONNECTOR", "POWER", "OTHER").contains(request.faultType))
            throw new ServiceException("故障类型不合法");
        request.priority = priority == null ? "NORMAL" : text(priority, 16, "优先级");
        if (!Arrays.asList("LOW", "NORMAL", "HIGH").contains(request.priority))
            throw new ServiceException("优先级不合法");
        request.description = text(description, 1000, "故障描述");
        try
        {
            request.occurredAt = OffsetDateTime.parse(text(occurredAt, 64, "告警时间"))
                               .toInstant()
                               .truncatedTo(ChronoUnit.MILLIS)
                               .toString();
        }
        catch (ServiceException ex)
        {
            throw ex;
        }
        catch (Exception ex)
        {
            throw new ServiceException("告警时间须为含时区的ISO8601格式");
        }
        return request;
    }

    private static String text(String value, int max, String label)
    {
        if (value == null || value.trim().isEmpty() || value.trim().length() > max)
            throw new ServiceException(label + "不能为空且不能超过" + max + "字");
        return value.trim();
    }
}
