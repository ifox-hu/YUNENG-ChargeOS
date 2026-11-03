package com.hcp.operator.alarm;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Autocommit delivery metadata stays outside the processor's business transaction. */
@Service
public class DeviceAlarmDelivery {
    private final JdbcTemplate jdbc;
    public DeviceAlarmDelivery(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public boolean claim(long id,String token,int maxAttempts,int leaseSeconds){
        jdbc.update("UPDATE c_device_alarm_event SET status='DEAD',last_error='Publish/receipt retry limit reached',lease_token=NULL "
            +"WHERE id=? AND status IN ('PENDING','PUBLISHING','SENT') AND next_retry_at<=NOW(3) AND publish_attempts>=?",id,maxAttempts);
        return jdbc.update("UPDATE c_device_alarm_event SET status='PUBLISHING',lease_token=?,publish_attempts=publish_attempts+1,"
            +"next_retry_at=TIMESTAMPADD(SECOND,?,NOW(3)) WHERE id=? AND status IN ('PENDING','PUBLISHING','SENT') "
            +"AND next_retry_at<=NOW(3) AND publish_attempts<?",token,leaseSeconds,id,maxAttempts)==1;
    }
    public void sent(long id,String token,String message,int receiptSeconds){
        jdbc.update("UPDATE c_device_alarm_event SET status='SENT',message_id=?,lease_token=NULL,last_error=NULL,"
            +"next_retry_at=TIMESTAMPADD(SECOND,?,NOW(3)) WHERE id=? AND status='PUBLISHING' AND lease_token=?",message,receiptSeconds,id,token);
    }
    public void sendFailed(long id,String token,int maxAttempts,String error){
        jdbc.update("UPDATE c_device_alarm_event SET status=IF(publish_attempts>=?,'DEAD','PENDING'),last_error=?,lease_token=NULL,"
            +"next_retry_at=TIMESTAMPADD(SECOND,LEAST(300,5*POW(2,LEAST(publish_attempts-1,6))),NOW(3)) "
            +"WHERE id=? AND status='PUBLISHING' AND lease_token=?",maxAttempts,shortError(error),id,token);
    }
    public long generation(long id){
        java.util.List<Long> versions=jdbc.queryForList("SELECT replay_generation FROM c_device_alarm_event WHERE id=?",Long.class,id);
        if(versions.isEmpty())throw new DeviceAlarmProcessor.UnknownEventException();
        return versions.get(0);
    }
    public void consumeFailed(long id,long generation,int maxFailures,String error){
        // MySQL assignments are evaluated left to right: evaluate threshold before increment.
        jdbc.update("UPDATE c_device_alarm_event SET status=IF(consume_failures+1>=?,'DEAD',status),"
            +"consume_failures=consume_failures+1,last_error=? WHERE id=? AND replay_generation=? AND status NOT IN ('PROCESSED','DEAD')",maxFailures,shortError(error),id,generation);
    }
    private String shortError(String error){return error==null?"Unknown failure":error.substring(0,Math.min(500,error.length()));}
}
