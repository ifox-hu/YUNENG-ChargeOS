package com.hcp.operator.points;

import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.apache.rocketmq.client.producer.SendResult;
import org.apache.rocketmq.client.producer.SendStatus;
import org.apache.rocketmq.common.message.Message;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Durable publish retries and missing-receipt compensation. Multiple instances use CAS leases. */
@Slf4j
@Component
@ConditionalOnProperty(name="hcp.points.mq.enabled", havingValue="true")
public class PointsEventPublisher {
    private final JdbcTemplate jdbc;
    private DefaultMQProducer producer;
    @Value("${hcp.points.mq.nameserver:hcp-mq-nameserver:9876}") private String nameserver;
    @Value("${hcp.points.mq.topic:CHARGE_POINTS_V1}") private String topic;
    @Value("${hcp.points.mq.max-attempts:12}") private int maxAttempts;
    @Value("${hcp.points.mq.receipt-timeout-seconds:120}") private int receiptTimeout;

    public PointsEventPublisher(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    private DefaultMQProducer producer() throws Exception {
        if (producer == null) {
            DefaultMQProducer candidate=new DefaultMQProducer("charge_points_outbox_v1");
            candidate.setNamesrvAddr(nameserver);
            candidate.setSendMsgTimeout(5000);
            candidate.setRetryTimesWhenSendFailed(0);
            candidate.setVipChannelEnabled(false);
            try { candidate.start(); producer=candidate; }
            catch (Exception ex) { candidate.shutdown(); throw ex; }
        }
        return producer;
    }

    @Scheduled(fixedDelayString="${hcp.points.mq.scan-ms:5000}", initialDelay=10000)
    public void compensate() {
        try {
            List<Map<String,Object>> rows=jdbc.queryForList("select event_id,publish_attempts from c_points_event "
                +"where status in ('PENDING','RETRY','PUBLISHING','SENT') and next_retry_at<=now() order by next_retry_at limit 20");
            for (Map<String,Object> row:rows) publish(row);
        } catch (Exception ex) { log.error("Points compensation scan failed",ex); }
    }

    private void publish(Map<String,Object> row) {
        String id=String.valueOf(row.get("event_id")), lease=UUID.randomUUID().toString();
        int attempts=((Number)row.get("publish_attempts")).intValue();
        if(attempts>=maxAttempts) {
            jdbc.update("update c_points_event set status='DEAD',last_error='Publish/receipt retry limit reached' "
                +"where event_id=? and publish_attempts>=? and status in ('PENDING','RETRY','PUBLISHING','SENT') and next_retry_at<=now()",id,maxAttempts);
            return;
        }
        // Lease exceeds send timeout. Token fences delayed senders after recovery/requeue.
        int claimed=jdbc.update("update c_points_event set status='PUBLISHING',lease_token=?,publish_attempts=publish_attempts+1,"
            +"next_retry_at=date_add(now(),interval 30 second) where event_id=? and publish_attempts=? "
            +"and status in ('PENDING','RETRY','PUBLISHING','SENT') and next_retry_at<=now()",lease,id,attempts);
        if(claimed==0) return;
        try {
            Message message=new Message(topic,"ORDER_SETTLED",id,id.getBytes(StandardCharsets.UTF_8));
            SendResult result=producer().send(message);
            if(result.getSendStatus()!=SendStatus.SEND_OK) throw new IllegalStateException("Broker status "+result.getSendStatus());
            // Consumer may already have committed CONSUMED: never overwrite that receipt.
            jdbc.update("update c_points_event set status='SENT',message_id=?,last_error=null,lease_token=null,"
                +"next_retry_at=date_add(now(),interval ? second) where event_id=? and status='PUBLISHING' and lease_token=?",
                result.getMsgId(),receiptTimeout,id,lease);
        } catch(Exception ex) {
            int delay=(int)Math.min(300,5L<<Math.min(attempts,6));
            String error=ex.getClass().getSimpleName()+": "+ex.getMessage();
            jdbc.update("update c_points_event set status=?,last_error=?,lease_token=null,next_retry_at=date_add(now(),interval ? second) "
                +"where event_id=? and status='PUBLISHING' and lease_token=?", attempts+1>=maxAttempts?"DEAD":"RETRY",
                error.substring(0,Math.min(500,error.length())),delay,id,lease);
            log.warn("Points publish failed event={} attempt={}",id,attempts+1);
        }
    }
    @PreDestroy public void shutdown() { if(producer!=null) producer.shutdown(); }
}
