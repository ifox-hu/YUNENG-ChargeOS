package com.hcp.operator.alarm;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.InvocationTargetException;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** Real input-contract tests; reflection permits RED before the new DTO exists. */
class DeviceAlarmRequestTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private Map<String,Object> input() {
        Map<String,Object> value=new LinkedHashMap<>();
        value.put("eventId"," evt-1 "); value.put("pileId"," pile-1 ");
        value.put("faultType","POWER"); value.put("description"," alarm ");
        value.put("occurredAt","2026-11-04T08:00:00.123456+08:00");
        return value;
    }
    private Map<?,?> normalize(Map<String,Object> value) throws Throwable {
        Class<?> type;
        try { type=Class.forName("com.hcp.operator.alarm.DeviceAlarmRequest"); }
        catch(ClassNotFoundException ex) { throw new AssertionError("Alarm input normalization is not implemented",ex); }
        Object request=mapper.convertValue(value,type);
        try { return mapper.convertValue(type.getMethod("normalized").invoke(request),Map.class); }
        catch(InvocationTargetException ex) { throw ex.getCause(); }
    }
    @Test void trimsAndDefaultsAndCanonicalizesEventTime() throws Throwable {
        Map<?,?> result=normalize(input());
        assertEquals("evt-1",result.get("eventId"));
        assertEquals("pile-1",result.get("pileId"));
        assertEquals("alarm",result.get("description"));
        assertEquals("NORMAL",result.get("priority"));
        assertEquals("2026-11-04T00:00:00.123Z",result.get("occurredAt"));
    }
    @Test void rejectsMissingOrOversizedIdentity() {
        for(String key:Arrays.asList("eventId","pileId","description","occurredAt")) {
            Map<String,Object> value=input(); value.put(key," ");
            assertThrows(com.hcp.common.core.exception.ServiceException.class,()->normalize(value),key);
        }
        Map<String,Object> value=input(); value.put("eventId",String.join("",Collections.nCopies(65,"x")));
        assertThrows(com.hcp.common.core.exception.ServiceException.class,()->normalize(value));
    }
    @Test void rejectsUnsupportedFaultAndPriorityAndUnzonedTime() {
        for(String[] bad:new String[][]{{"faultType","BROKEN"},{"priority","URGENT"},{"occurredAt","2026-11-04T08:00:00"}}) {
            Map<String,Object> value=input(); value.put(bad[0],bad[1]);
            assertThrows(com.hcp.common.core.exception.ServiceException.class,()->normalize(value));
        }
    }
}
