package com.hcp.operator.alarm;

import com.hcp.operator.service.FaultTicketService;
import java.lang.reflect.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.FileSystemResource;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import static org.junit.jupiter.api.Assertions.*;

/** Real MySQL and Spring transaction proxies; no H2 or mocked unique constraints. */
@EnabledIfSystemProperty(named="alarm.integration",matches="true")
class DeviceAlarmEventServiceTest {
    @Configuration @EnableTransactionManagement
    static class Config {
        @Bean DriverManagerDataSource dataSource(){return new DriverManagerDataSource(
            System.getProperty("alarm.jdbc","jdbc:mysql://127.0.0.1:3307/vctgo_platform?useSSL=false&serverTimezone=Asia/Shanghai"),"root","password");}
        @Bean JdbcTemplate jdbcTemplate(){return new JdbcTemplate(dataSource());}
        @Bean DataSourceTransactionManager transactionManager(){return new DataSourceTransactionManager(dataSource());}
        @Bean FaultTicketService faultTicketService(){return new FaultTicketService();}
    }
    private AnnotationConfigApplicationContext context;
    private JdbcTemplate jdbc;
    private Object service,processor;
    private FaultTicketService.Scope scope;
    private String run;
    @BeforeEach void setup() throws Exception {
        Class<?> eventType;
        try{eventType=Class.forName("com.hcp.operator.alarm.DeviceAlarmEventService");}
        catch(ClassNotFoundException ex){throw new AssertionError("Durable alarm acceptance is not implemented",ex);}
        context=new AnnotationConfigApplicationContext();context.register(Config.class);
        context.registerBean("alarmEvents",eventType);
        context.registerBean("alarmProcessor",Class.forName("com.hcp.operator.alarm.DeviceAlarmProcessor"));context.refresh();
        service=context.getBean("alarmEvents");processor=context.getBean("alarmProcessor");jdbc=context.getBean(JdbcTemplate.class);
        new ResourceDatabasePopulator(new FileSystemResource("../../docker/device-alarm.sql")).execute(context.getBean(DriverManagerDataSource.class));
        Constructor<FaultTicketService.Scope> constructor=FaultTicketService.Scope.class.getDeclaredConstructor(Long.class,Long.class,String.class,boolean.class);
        constructor.setAccessible(true);scope=constructor.newInstance(1L,9999L,"test-operator",false);
        run="QA_JALARM_"+UUID.randomUUID().toString().replace("-","").substring(0,14);
        for(int i=0;i<3;i++)jdbc.update("INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id) VALUES(?,?,1,?)",run+i,"isolated test",i==2?9998:9999);
    }
    private DeviceAlarmRequest input(String event,int device){DeviceAlarmRequest r=new DeviceAlarmRequest();
        r.setEventId(run+event);r.setPileId(run+device);r.setFaultType("POWER");r.setDescription("test alarm");r.setOccurredAt("2026-11-04T00:00:00Z");return r;}
    @SuppressWarnings("unchecked") private Map<String,Object> accept(DeviceAlarmRequest r) throws Throwable{
        try{return (Map<String,Object>)service.getClass().getMethod("accept",DeviceAlarmRequest.class,FaultTicketService.Scope.class).invoke(service,r,scope);}
        catch(InvocationTargetException ex){throw ex.getCause();}}
    private void process(long id) throws Throwable{try{processor.getClass().getMethod("process",long.class).invoke(processor,id);}catch(InvocationTargetException ex){throw ex.getCause();}}
    private long id(Map<String,Object> r){return ((Number)r.get("id")).longValue();}
    @Test void sameKeySamePayloadReturnsOriginal() throws Throwable{
        Map<String,Object> a=accept(input("a",0)),b=accept(input("a",0));assertEquals(id(a),id(b));assertEquals(true,b.get("duplicate"));
        assertEquals(1L,jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm_event WHERE event_id=?",Long.class,run+"a"));}
    @Test void sameKeyDifferentPayloadRejected() throws Throwable{
        accept(input("a",0));DeviceAlarmRequest changed=input("a",1);
        assertThrows(com.hcp.common.core.exception.ServiceException.class,()->accept(changed));
        assertEquals(run+"0",jdbc.queryForObject("SELECT pile_id FROM c_device_alarm_event WHERE event_id=?",String.class,run+"a"));}
    @Test void foreignTenantRejectedBeforeLookup(){assertThrows(com.hcp.common.core.exception.ServiceException.class,()->accept(input("a",2)));}
    @Test void duplicateConsumeHasOneSideEffectAndDifferentEventsMerge() throws Throwable{
        long a=id(accept(input("a",0)));process(a);process(a);
        long b=id(accept(input("b",0)));process(b);
        assertEquals(1L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id=?",Long.class,run+"0"));
        assertEquals(2L,jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm WHERE pile_id=?",Long.class,run+"0"));
        assertEquals(2L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id=?)",Long.class,run+"0"));}
    @Test void differentDevicesDoNotMergeAndOldEventDoesNotReopen() throws Throwable{
        long a=id(accept(input("a",0))),b=id(accept(input("b",1)));process(a);process(b);
        jdbc.update("UPDATE c_fault_ticket SET status='CLOSED' WHERE pile_id=?",run+"0");process(a);
        assertEquals(2L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id IN (?,?)",Long.class,run+"0",run+"1"));
        long c=id(accept(input("c",0)));process(c);
        assertEquals(2L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id=?",Long.class,run+"0"));}
    @Test void changedDeviceTenantRejected() throws Throwable{
        long a=id(accept(input("a",0)));jdbc.update("UPDATE c_charging_pile SET tenant_id=9998 WHERE pile_id=?",run+"0");
        assertThrows(com.hcp.common.core.exception.ServiceException.class,()->process(a));
        assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id=?",Long.class,run+"0"));}
    @Test void terminalWriteFailureRollsBackAllSideEffects() throws Throwable{
        long a=id(accept(input("a",0)));String trigger="qaa_"+run.substring(10);
        // The live delivery scheduler may claim a newly accepted row. Hold it outside
        // the retry window so this test isolates processor transaction rollback.
        jdbc.update("UPDATE c_device_alarm_event SET status='PENDING',next_retry_at=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE id=?",a);
        jdbc.execute("CREATE TRIGGER "+trigger+" BEFORE UPDATE ON c_device_alarm_event FOR EACH ROW BEGIN IF NEW.id="+a+" AND NEW.status='PROCESSED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='alarm rollback test'; END IF; END");
        try{assertThrows(Exception.class,()->process(a));assertEquals("PENDING",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
            assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id=?",Long.class,run+"0"));
            assertEquals(0L,jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm WHERE pile_id=?",Long.class,run+"0"));
        }finally{jdbc.execute("DROP TRIGGER "+trigger);}}
    @Test void transferredDeviceCannotMergeIntoOldTenantsActiveTicket() throws Throwable {
        long a=id(accept(input("a",0)));process(a);
        jdbc.update("UPDATE c_charging_pile SET tenant_id=9998 WHERE pile_id=?",run+"0");
        Constructor<FaultTicketService.Scope> c=FaultTicketService.Scope.class.getDeclaredConstructor(Long.class,Long.class,String.class,boolean.class);
        c.setAccessible(true);scope=c.newInstance(2L,9998L,"new-tenant",false);
        long b=id(accept(input("b",0)));
        assertThrows(com.hcp.common.core.exception.ServiceException.class,()->process(b));
        assertEquals(1L,jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm WHERE pile_id=?",Long.class,run+"0"));
        assertEquals(1L,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id=?)",Long.class,run+"0"));
        assertEquals("PENDING",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,b));
    }
    @Test void maximumDescriptionIsProcessedWithoutLosingOriginal() throws Throwable {
        DeviceAlarmRequest r=input("max",0);String description=String.join("",Collections.nCopies(1000,"警"));r.setDescription(description);
        long a=id(accept(r));process(a);
        assertEquals("PROCESSED",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
        assertEquals(description,jdbc.queryForObject("SELECT description FROM c_fault_ticket WHERE pile_id=?",String.class,run+"0"));
        assertEquals(1000,jdbc.queryForObject("SELECT CHAR_LENGTH(note) FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id=?)",Integer.class,run+"0"));
    }
    @Test void lateFailureCannotPoisonManualReplayGeneration() throws Throwable {
        long a=id(accept(input("a",0)));Object d=delivery();
        failAttempt(d,a,0L,"first generation failure");
        call(service,"replay",new Class<?>[]{long.class,FaultTicketService.Scope.class},a,scope);
        failAttempt(d,a,0L,"late old generation failure");
        assertEquals("PENDING",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
        assertEquals(0,jdbc.queryForObject("SELECT consume_failures FROM c_device_alarm_event WHERE id=?",Integer.class,a));
        failAttempt(d,a,1L,"current generation failure");
        assertEquals("DEAD",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
    }
    private void failAttempt(Object d,long id,long generation,String message)throws Throwable {
        try{d.getClass().getMethod("consumeFailed",long.class,long.class,int.class,String.class);}
        catch(NoSuchMethodException absent){call(d,"consumeFailed",new Class<?>[]{long.class,int.class,String.class},id,1,message);return;}
        call(d,"consumeFailed",new Class<?>[]{long.class,long.class,int.class,String.class},id,generation,1,message);
    }
    private Object delivery()throws Exception{
        Class<?> type;
        try{type=Class.forName("com.hcp.operator.alarm.DeviceAlarmDelivery");}
        catch(ClassNotFoundException ex){throw new AssertionError("Alarm delivery leases are not implemented",ex);}
        return type.getConstructor(JdbcTemplate.class).newInstance(jdbc);
    }
    private Object call(Object target,String method,Class<?>[] signature,Object...args)throws Throwable{
        try{return target.getClass().getMethod(method,signature).invoke(target,args);}catch(InvocationTargetException ex){throw ex.getCause();}
    }
    @Test void expiredLeaseCanBeClaimedAndStaleSenderCannotOverwrite()throws Throwable{
        long a=id(accept(input("a",0)));Object d=delivery();
        Class<?>[] claim={long.class,String.class,int.class,int.class};
        assertEquals(true,call(d,"claim",claim,a,"first",3,30));
        assertEquals(false,call(d,"claim",claim,a,"second",3,30));
        jdbc.update("UPDATE c_device_alarm_event SET next_retry_at=DATE_SUB(NOW(3),INTERVAL 1 SECOND) WHERE id=?",a);
        assertEquals(true,call(d,"claim",claim,a,"second",3,30));
        call(d,"sent",new Class<?>[]{long.class,String.class,String.class,int.class},a,"first","old-message",120);
        assertEquals("second",jdbc.queryForObject("SELECT lease_token FROM c_device_alarm_event WHERE id=?",String.class,a));
        process(a);
        call(d,"sent",new Class<?>[]{long.class,String.class,String.class,int.class},a,"second","new-message",120);
        assertEquals("PROCESSED",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
    }
    @Test void failureIsDurableAndManualReplayIsAudited()throws Throwable{
        long a=id(accept(input("a",0)));Object d=delivery();
        failAttempt(d,a,0L,"injected failure");
        assertEquals("DEAD",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
        call(service,"replay",new Class<?>[]{long.class,FaultTicketService.Scope.class},a,scope);
        assertEquals("PENDING",jdbc.queryForObject("SELECT status FROM c_device_alarm_event WHERE id=?",String.class,a));
        assertEquals(1L,jdbc.queryForObject("SELECT COUNT(*) FROM c_device_alarm_event_audit WHERE event_pk=?",Long.class,a));
        process(a);
        assertThrows(com.hcp.common.core.exception.ServiceException.class,()->call(service,"replay",new Class<?>[]{long.class,FaultTicketService.Scope.class},a,scope));
    }
    @AfterEach void cleanup(){if(jdbc!=null&&run!=null){
        jdbc.update("DELETE FROM c_device_alarm_event_audit WHERE event_pk IN (SELECT id FROM c_device_alarm_event WHERE pile_id LIKE ?)",run+"%");
        jdbc.update("DELETE FROM c_device_alarm_event WHERE pile_id LIKE ?",run+"%");
        jdbc.update("DELETE FROM c_fault_ticket_log WHERE ticket_id IN (SELECT id FROM c_fault_ticket WHERE pile_id LIKE ?)",run+"%");
        jdbc.update("DELETE FROM c_device_alarm WHERE pile_id LIKE ?",run+"%");jdbc.update("DELETE FROM c_fault_ticket WHERE pile_id LIKE ?",run+"%");jdbc.update("DELETE FROM c_charging_pile WHERE pile_id LIKE ?",run+"%");
    }if(context!=null)context.close();}
}
