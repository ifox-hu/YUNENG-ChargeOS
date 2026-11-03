package com.hcp.operator.alarm;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.service.FaultTicketService.Scope;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class DeviceAlarmEventService {
    private final JdbcTemplate jdbc;
    private static final String VIEW="SELECT id,event_id AS eventId,tenant_id AS tenantId,pile_id AS pileId,"
        +"fault_type AS faultType,priority,description,occurred_at AS occurredAt,status,ticket_id AS ticketId,"
        +"publish_attempts AS publishAttempts,consume_failures AS consumeFailures,last_error AS lastError,"
        +"received_at AS receivedAt,processed_at AS processedAt FROM c_device_alarm_event ";
    public DeviceAlarmEventService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> accept(DeviceAlarmRequest input,Scope scope) {
        if(scope==null)throw new ServiceException("请先登录",401);
        DeviceAlarmRequest r=input.normalized();
        List<Map<String,Object>> devices=jdbc.queryForList("SELECT tenant_id FROM c_charging_pile WHERE pile_id=? AND deleted=0",r.getPileId());
        if(devices.isEmpty())throw new ServiceException("设备不存在");
        long tenant=((Number)devices.get(0).get("tenant_id")).longValue();
        if(!scope.root && tenant!=scope.tenant)throw new ServiceException("无权操作该租户设备",403);
        boolean duplicate=false;
        try{
            jdbc.update("INSERT INTO c_device_alarm_event(tenant_id,event_id,pile_id,fault_type,priority,description,occurred_at,actor_id,actor_name) VALUES(?,?,?,?,?,?,?,?,?)",
                tenant,r.getEventId(),r.getPileId(),r.getFaultType(),r.getPriority(),r.getDescription(),r.getOccurredAt(),scope.id,scope.name);
        }catch(DuplicateKeyException ex){duplicate=true;}
        Map<String,Object> row=jdbc.queryForMap(VIEW+"WHERE tenant_id=? AND event_id=?",tenant,r.getEventId());
        if(!Objects.equals(row.get("pileId"),r.getPileId()) || !Objects.equals(row.get("faultType"),r.getFaultType())
            || !Objects.equals(row.get("priority"),r.getPriority()) || !Objects.equals(row.get("description"),r.getDescription())
            || !Objects.equals(row.get("occurredAt"),r.getOccurredAt()))throw new ServiceException("同一事件编号的告警内容不一致",409);
        row.put("duplicate",duplicate);return row;
    }
    public Map<String,Object> detail(long id,Scope scope){
        String where=scope.root?"WHERE id=?":"WHERE id=? AND tenant_id=?";
        List<Map<String,Object>> rows=jdbc.queryForList(VIEW+where,scope.root?new Object[]{id}:new Object[]{id,scope.tenant});
        if(rows.isEmpty())throw new ServiceException("告警不存在或无权访问",403);return rows.get(0);
    }
    public Map<String,Object> list(Scope scope,String status,String pileId,int page,int size){
        if(page<1||page>100000||size<1||size>50)throw new ServiceException("分页参数不合法");
        List<Object> args=new ArrayList<>();String where="WHERE 1=1";
        if(!scope.root){where+=" AND tenant_id=?";args.add(scope.tenant);}
        if(status!=null&&!status.isEmpty()){
            if(!Arrays.asList("PENDING","PUBLISHING","SENT","PROCESSED","DEAD").contains(status))throw new ServiceException("告警状态不合法");
            where+=" AND status=?";args.add(status);
        }
        if(pileId!=null&&!pileId.isEmpty()){where+=" AND pile_id=?";args.add(pileId);}
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm_event "+where,Long.class,args.toArray());
        args.add(size);args.add((page-1)*size);
        Map<String,Object> result=new LinkedHashMap<>();result.put("total",total);
        result.put("records",jdbc.queryForList(VIEW+where+" ORDER BY id DESC LIMIT ? OFFSET ?",args.toArray()));return result;
    }
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> replay(long id,Scope scope){
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT tenant_id,status FROM c_device_alarm_event WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ServiceException("告警不存在");
        Map<String,Object> row=rows.get(0);
        if(!scope.root && ((Number)row.get("tenant_id")).longValue()!=scope.tenant)throw new ServiceException("无权操作",403);
        if(!"DEAD".equals(row.get("status")))throw new ServiceException("仅失败终止事件允许重放",409);
        jdbc.update("UPDATE c_device_alarm_event SET status='PENDING',publish_attempts=0,consume_failures=0,replay_generation=replay_generation+1,lease_token=NULL,last_error=NULL,next_retry_at=NOW(3) WHERE id=?",id);
        jdbc.update("INSERT INTO c_device_alarm_event_audit(event_pk,actor_id,action) VALUES(?,?,'REPLAY')",id,scope.id);
        return detail(id,scope);
    }
}
