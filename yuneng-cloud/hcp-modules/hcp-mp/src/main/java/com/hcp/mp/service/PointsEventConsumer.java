package com.hcp.mp.service;

import java.nio.charset.StandardCharsets;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.consumer.DefaultMQPushConsumer;
import org.apache.rocketmq.client.consumer.listener.MessageListenerConcurrently;
import org.apache.rocketmq.client.consumer.listener.ConsumeConcurrentlyStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(name="hcp.points.mq.enabled",havingValue="true")
public class PointsEventConsumer {
    private final JdbcTemplate jdbc;
    private final PointsEventAwardService awards;
    private DefaultMQPushConsumer consumer;
    @Value("${hcp.points.mq.nameserver:hcp-mq-nameserver:9876}") private String nameserver;
    @Value("${hcp.points.mq.topic:CHARGE_POINTS_V1}") private String topic;
    @Value("${hcp.points.mq.max-consume-failures:12}") private int maxFailures;
    public PointsEventConsumer(JdbcTemplate jdbc,PointsEventAwardService awards) { this.jdbc=jdbc; this.awards=awards; }

    // Retry client initialization as well, so broker startup order does not prevent app startup.
    @Scheduled(fixedDelay=10000,initialDelay=5000)
    public void connect() {
        if(consumer!=null) return;
        DefaultMQPushConsumer candidate=new DefaultMQPushConsumer("charge_points_award_v1");
        candidate.setNamesrvAddr(nameserver);
        candidate.setConsumeFromWhere(org.apache.rocketmq.common.consumer.ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
        candidate.setVipChannelEnabled(false);
        candidate.setConsumeMessageBatchMaxSize(1);
        candidate.setMaxReconsumeTimes(12);
        candidate.setConsumeThreadMin(2);
        candidate.setConsumeThreadMax(4);
        try {
            candidate.subscribe(topic,"ORDER_SETTLED");
            candidate.registerMessageListener((MessageListenerConcurrently)(messages,context)-> {
                String id=new String(messages.get(0).getBody(),StandardCharsets.UTF_8);
                try {
                    if(!id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("Invalid event id");
                    awards.consume(id);
                    return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
                } catch(Exception ex) {
                    // Separate autocommit AFTER award rollback; the failure survives the rollback.
                    try {
                        String error=ex.getClass().getSimpleName()+": "+ex.getMessage();
                        jdbc.update("update c_points_event set consume_failures=consume_failures+1,"
                            +"status=if(consume_failures>=?,'DEAD',status),last_error=? "
                            +"where event_id=? and status not in ('CONSUMED','DEAD')",maxFailures,
                            error.substring(0,Math.min(500,error.length())),id);
                    } catch(Exception recordingError) { log.error("Cannot record points failure event={}",id,recordingError); }
                    log.warn("Points award failed event={}",id);
                    return ConsumeConcurrentlyStatus.RECONSUME_LATER;
                }
            });
            candidate.start(); consumer=candidate;
            log.info("Points MQ consumer connected");
        } catch(Exception ex) { candidate.shutdown(); log.warn("Points MQ consumer initialization will retry",ex); }
    }
    @PreDestroy public void shutdown() { if(consumer!=null) consumer.shutdown(); }
}
