package com.hcp.operator.alarm;

import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.producer.*;
import org.apache.rocketmq.common.message.Message;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j @Component
@ConditionalOnProperty(name="hcp.alarm.mq.enabled",havingValue="true")
public class DeviceAlarmPublisher {
    private final JdbcTemplate jdbc;private final DeviceAlarmDelivery delivery;private final DeviceAlarmMqConfig config;
    private DefaultMQProducer producer;private boolean closed;
    public DeviceAlarmPublisher(JdbcTemplate jdbc,DeviceAlarmDelivery delivery,DeviceAlarmMqConfig config){this.jdbc=jdbc;this.delivery=delivery;this.config=config;}
    private synchronized boolean connect(){
        if(closed)return false;if(producer!=null)return true;
        DefaultMQProducer candidate=new DefaultMQProducer(config.getProducerGroup());
        candidate.setInstanceName("alarm-publisher");candidate.setNamesrvAddr(config.getNameServer());
        candidate.setSendMsgTimeout(config.getSendTimeoutMs());candidate.setRetryTimesWhenSendFailed(0);
        candidate.setRetryAnotherBrokerWhenNotStoreOK(false);
        try{candidate.start();producer=candidate;return true;}
        catch(Exception ex){candidate.shutdown();log.warn("Alarm producer connection failed; retrying on next scan",ex);return false;}
    }
    @Scheduled(fixedDelayString="${hcp.alarm.mq.scan-ms:1000}",initialDelay=3000)
    public void scan(){
        if(!connect())return;
        try{
            List<Long> ids=jdbc.queryForList("SELECT id FROM c_device_alarm_event WHERE status IN ('PENDING','PUBLISHING','SENT') "
                +"AND next_retry_at<=NOW(3) ORDER BY next_retry_at,id LIMIT ?",Long.class,config.getBatchSize());
            for(Long id:ids){
                String lease=UUID.randomUUID().toString();
                if(!delivery.claim(id,lease,config.getMaxAttempts(),config.getLeaseSeconds()))continue;
                try{
                    SendResult sent=producer.send(new Message(config.getTopic(),"DEVICE_ALARM",String.valueOf(id),String.valueOf(id).getBytes(StandardCharsets.UTF_8)));
                    if(sent.getSendStatus()!=SendStatus.SEND_OK)throw new IllegalStateException("Broker status "+sent.getSendStatus());
                    delivery.sent(id,lease,sent.getMsgId(),config.getReceiptTimeoutSeconds());
                }catch(Exception ex){delivery.sendFailed(id,lease,config.getMaxAttempts(),ex.getClass().getSimpleName()+": "+ex.getMessage());}
            }
        }catch(Exception ex){log.error("Alarm publish scan failed; durable events remain recoverable",ex);}
    }
    @PreDestroy public synchronized void shutdown(){closed=true;if(producer!=null)producer.shutdown();}
}
