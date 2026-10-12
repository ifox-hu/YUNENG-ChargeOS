package com.hcp.operator.service;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.system.api.domain.FaultRequest;
import com.hcp.system.api.model.LoginUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import javax.annotation.Resource;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@Service
public class FaultTicketService {
    @Resource private JdbcTemplate jdbc;
    private static final Set<String> TYPES = new HashSet<>(Arrays.asList("OFFLINE","CONNECTOR","POWER","OTHER"));
    private static final String SELECT = "SELECT t.id,t.ticket_no AS ticketNo,t.pile_id AS pileId,p.name AS pileName,"
        + "t.tenant_id AS tenantId,t.fault_type AS faultType,t.priority,t.source,t.description,t.status,"
        + "t.assignee_id AS assigneeId,t.assignee_name AS assigneeName,t.created_at AS createdAt,"
        + "t.updated_at AS updatedAt,t.resolved_at AS resolvedAt,t.closed_at AS closedAt "
        + "FROM c_fault_ticket t LEFT JOIN c_charging_pile p ON p.pile_id=t.pile_id ";

    public static class Scope {
        public final Long id, tenant;
        public final String name;
        public final boolean root;
        Scope(Long id,Long tenant,String name,boolean root) {
            this.id=id; this.tenant=tenant; this.name=name; this.root=root;
        }
    }
    public Scope operator() {
        LoginUser u = SecurityUtils.getLoginUser();
        if (u == null || u.getSysUser() == null) throw new ServiceException("请先登录",401);
        Long id=u.getSysUser().getUserId(), tenant=u.getSysUser().getTenantId();
        if (id == null || tenant == null) throw new ServiceException("无有效运营身份",403);
        return new Scope(id,tenant,u.getSysUser().getUserName(),id == 1L);
    }
    private String text(String value,int max,String label) {
        if (value == null || value.trim().isEmpty() || value.trim().length()>max)
            throw new ServiceException(label+"不能为空且不能超过"+max+"字");
        return value.trim();
    }
    private Map<String,Object> ticket(Long id,boolean lock) {
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT * FROM c_fault_ticket WHERE id=?"+(lock?" FOR UPDATE":""),id);
        if (rows.isEmpty()) throw new ServiceException("工单不存在");
        return rows.get(0);
    }
    private void allowed(Map<String,Object> row,Scope scope) {
        if (!scope.root && !String.valueOf(scope.tenant).equals(String.valueOf(row.get("tenant_id"))))
            throw new ServiceException("无权访问该租户的工单",403);
    }
    private void memberExists(Long id) {
        if (id == null || jdbc.queryForObject("SELECT COUNT(*) FROM c_member WHERE member_id=?",Long.class,id)==0)
            throw new ServiceException("用户不存在",401);
    }
    private void owns(Long ticketId,Long memberId) {
        memberExists(memberId);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_report WHERE ticket_id=? AND member_id=?",
                Long.class,ticketId,memberId)==0) throw new ServiceException("无权查看或操作该报修",403);
    }
    private void log(Long id,String action,String before,String after,String actorType,Long actorId,String actorName,String note) {
        jdbc.update("INSERT INTO c_fault_ticket_log(ticket_id,action,from_status,to_status,actor_type,actor_id,actor_name,note)"
            +" VALUES(?,?,?,?,?,?,?,?)",id,action,before,after,actorType,actorId,actorName,note);
    }

    /** Pile row lock serializes competing reports; generated unique key is a second DB invariant. */
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> create(FaultRequest request,Long memberId,Scope scope) {
        String pileId=text(request.getPileId(),64,"设备编号");
        String type=text(request.getFaultType(),24,"故障类型");
        if (!TYPES.contains(type)) throw new ServiceException("故障类型不合法");
        String description=text(request.getDescription(),1000,"故障描述");
        String priority=request.getPriority()==null?"NORMAL":request.getPriority();
        if (!Arrays.asList("LOW","NORMAL","HIGH").contains(priority)) throw new ServiceException("优先级不合法");
        if (memberId!=null) { memberExists(memberId); priority="NORMAL"; }
        List<Map<String,Object>> piles=jdbc.queryForList(
            "SELECT pile_id,tenant_id FROM c_charging_pile WHERE pile_id=? AND deleted=0 FOR UPDATE",pileId);
        if (piles.isEmpty()) throw new ServiceException("设备不存在，请检查桩编号");
        Object tenant=piles.get(0).get("tenant_id");
        if (scope!=null && !scope.root && !String.valueOf(scope.tenant).equals(String.valueOf(tenant)))
            throw new ServiceException("无权操作该租户设备",403);
        List<Map<String,Object>> active=jdbc.queryForList(
            "SELECT id,status FROM c_fault_ticket WHERE pile_id=? AND fault_type=? AND status<>'CLOSED' FOR UPDATE",pileId,type);
        boolean merged=!active.isEmpty();
        Long id; String status;
        if (merged) {
            id=((Number)active.get(0).get("id")).longValue(); status=String.valueOf(active.get(0).get("status"));
        } else {
            final String finalPriority=priority;
            GeneratedKeyHolder keys=new GeneratedKeyHolder();
            jdbc.update(connection -> {
                PreparedStatement ps=connection.prepareStatement(
                    "INSERT INTO c_fault_ticket(ticket_no,pile_id,tenant_id,fault_type,priority,source,description)"
                    +" VALUES(?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
                ps.setString(1,"FT"+UUID.randomUUID().toString().replace("-",""));
                ps.setString(2,pileId); ps.setObject(3,tenant); ps.setString(4,type);
                ps.setString(5,finalPriority); ps.setString(6,memberId==null?"ALERT":"USER");
                ps.setString(7,description); return ps;
            },keys);
            id=Objects.requireNonNull(keys.getKey()).longValue(); status="NEW";
        }
        if (memberId!=null) {
            int added=jdbc.update("INSERT IGNORE INTO c_fault_report(ticket_id,member_id,description) VALUES(?,?,?)",
                    id,memberId,description);
            // Same user's retries do not create repeated report records or timeline entries.
            if (added>0) log(id,merged?"MERGE_REPORT":"REPORT",merged?status:null,status,"MEMBER",memberId,"报修用户",
                merged?"用户报修已合并到当前工单":"用户提交故障报修");
        } else {
            jdbc.update("INSERT INTO c_device_alarm(event_id,ticket_id,pile_id,fault_type) VALUES(?,?,?,?)",
                "SIM-"+UUID.randomUUID(),id,pileId,type);
            log(id,merged?"MERGE_ALARM":"ALARM",merged?status:null,status,"OPERATOR",scope.id,scope.name,
                (merged?"模拟告警合并：":"模拟设备告警：")+description);
        }
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("ticket",jdbc.queryForMap(SELECT+"WHERE t.id=?",id));
        result.put("merged",merged); return result;
    }

    public Map<String,Object> list(Scope scope,Long memberId,String status,String type,String pileId,int page,int size) {
        if (page<1 || page>100000 || size<1 || size>50) throw new ServiceException("分页参数不合法");
        StringBuilder where=new StringBuilder(" WHERE 1=1 ");
        List<Object> args=new ArrayList<>();
        if (scope!=null && !scope.root) { where.append("AND t.tenant_id=? "); args.add(scope.tenant); }
        if (memberId!=null) {
            memberExists(memberId);
            where.append("AND EXISTS(SELECT 1 FROM c_fault_report r WHERE r.ticket_id=t.id AND r.member_id=?) ");
            args.add(memberId);
        }
        if (status!=null && !status.isEmpty()) { where.append("AND t.status=? "); args.add(status); }
        if (type!=null && !type.isEmpty()) { where.append("AND t.fault_type=? "); args.add(type); }
        if (pileId!=null && !pileId.isEmpty()) { where.append("AND t.pile_id=? "); args.add(pileId); }
        Long total=jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket t"+where,Long.class,args.toArray());
        args.add(size); args.add((page-1)*size);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("total",total);
        result.put("records",jdbc.queryForList(SELECT+where+"ORDER BY t.id DESC LIMIT ? OFFSET ?",args.toArray()));
        return result;
    }
    public Map<String,Object> detail(Long id,Scope scope,Long memberId) {
        Map<String,Object> row=ticket(id,false);
        if (scope!=null) allowed(row,scope); else owns(id,memberId);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("ticket",jdbc.queryForMap(SELECT+"WHERE t.id=?",id));
        result.put("logs",jdbc.queryForList("SELECT id,action,from_status AS fromStatus,to_status AS toStatus,"
            +"actor_name AS actorName,note,created_at AS createdAt FROM c_fault_ticket_log WHERE ticket_id=? ORDER BY id",id));
        if (scope!=null) {
            result.put("reports",jdbc.queryForList("SELECT member_id AS memberId,description,created_at AS createdAt "
                +"FROM c_fault_report WHERE ticket_id=? ORDER BY created_at",id));
            result.put("alarms",jdbc.queryForList("SELECT event_id AS eventId,created_at AS createdAt "
                +"FROM c_device_alarm WHERE ticket_id=? ORDER BY id",id));
        }
        return result;
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> action(Long id,FaultRequest request,Scope scope,Long memberId) {
        Map<String,Object> row=ticket(id,true);
        if (scope!=null) allowed(row,scope); else owns(id,memberId);
        String before=String.valueOf(row.get("status")), action=request.getAction(), after;
        String note=text(request.getNote(),1000,"处理说明");
        if (memberId!=null && !"CONFIRM".equals(action)) throw new ServiceException("操作不允许",403);
        if ("ASSIGN".equals(action)) {
            if (!Arrays.asList("NEW","ASSIGNED").contains(before)) throw new ServiceException("只能分配待分配或已分配工单");
            if (request.getAssigneeId()==null) throw new ServiceException("请选择处理人");
            List<Map<String,Object>> users=jdbc.queryForList(
                "SELECT user_id,nick_name FROM sys_user WHERE user_id=? AND tenant_id=? AND status='0' AND del_flag='0'",
                request.getAssigneeId(),row.get("tenant_id"));
            if (users.isEmpty()) throw new ServiceException("处理人不存在或不属于该租户");
            jdbc.update("UPDATE c_fault_ticket SET assignee_id=?,assignee_name=? WHERE id=?",
                request.getAssigneeId(),users.get(0).get("nick_name"),id);
            after="ASSIGNED";
        } else if ("START".equals(action) || "RESOLVE".equals(action)) {
            if (scope==null || (!scope.root && !String.valueOf(scope.id).equals(String.valueOf(row.get("assignee_id")))))
                throw new ServiceException("仅处理人或超级管理员可处理",403);
            if ("START".equals(action)) {
                if (!"ASSIGNED".equals(before)) throw new ServiceException("请先分配工单再开始处理");
                after="PROCESSING";
            } else {
                if (!"PROCESSING".equals(before)) throw new ServiceException("只有处理中工单可以提交解决结果");
                after="RESOLVED";
                jdbc.update("UPDATE c_fault_ticket SET resolved_at=NOW() WHERE id=?",id);
            }
        } else if ("CONFIRM".equals(action)) {
            if (!"RESOLVED".equals(before)) throw new ServiceException("只有待确认工单可以关闭");
            after="CLOSED";
            jdbc.update("UPDATE c_fault_ticket SET closed_at=NOW() WHERE id=?",id);
        } else throw new ServiceException("操作类型不合法");
        jdbc.update("UPDATE c_fault_ticket SET status=?,updated_at=NOW() WHERE id=?",after,id);
        log(id,action,before,after,scope==null?"MEMBER":"OPERATOR",scope==null?memberId:scope.id,
            scope==null?"报修用户":scope.name,note);
        return detail(id,scope,memberId);
    }
    public List<Map<String,Object>> assignees(Scope scope,Long id) {
        Map<String,Object> row=ticket(id,false); allowed(row,scope);
        return jdbc.queryForList("SELECT user_id AS userId,nick_name AS nickName,user_name AS userName "
            +"FROM sys_user WHERE tenant_id=? AND status='0' AND del_flag='0' ORDER BY user_id",row.get("tenant_id"));
    }
    public Map<String,Object> stats(Scope scope) {
        String where=scope.root?"":" WHERE tenant_id=?";
        Object[] args=scope.root?new Object[]{}:new Object[]{scope.tenant};
        Map<String,Object> result=jdbc.queryForMap(
            "SELECT COUNT(*) AS total,COALESCE(SUM(status<>'CLOSED'),0) AS active,"
            +"COALESCE(SUM(status='NEW'),0) AS pending,COALESCE(SUM(status='CLOSED'),0) AS closed,"
            +"ROUND(AVG(TIMESTAMPDIFF(MINUTE,created_at,resolved_at)),1) AS avgResolveMinutes FROM c_fault_ticket"+where,args);
        result.put("byType",jdbc.queryForList("SELECT fault_type AS faultType,COUNT(*) AS count FROM c_fault_ticket"
            +where+" GROUP BY fault_type",args));
        result.put("trend",jdbc.queryForList("SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS day,COUNT(*) AS count "
            +"FROM c_fault_ticket"+(where.isEmpty()?" WHERE ":where+" AND ")
            +"created_at>=DATE_SUB(CURDATE(),INTERVAL 6 DAY) GROUP BY day ORDER BY day",args));
        result.put("alarmCount",jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm a JOIN c_fault_ticket t ON t.id=a.ticket_id"
            +(scope.root?"":" WHERE t.tenant_id=?"),Long.class,args));
        return result;
    }
}
