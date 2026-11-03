package com.hcp.mp.service;

import java.nio.charset.StandardCharsets;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.consumer.DefaultMQPushConsumer;
import org.apache.rocketmq.client.consumer.listener.ConsumeConcurrentlyStatus;
import org.apache.rocketmq.client.consumer.listener.MessageListenerConcurrently;
import org.apache.rocketmq.common.consumer.ConsumeFromWhere;
import org.apache.rocketmq.common.message.MessageExt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** RocketMQ delivery; SQL owns the durable failure limit and award receipt. */
@Slf4j
@Component
@ConditionalOnProperty(name="hcp.points.mq.enabled", havingValue="true")
public class PointsEventConsumer {
    private final JdbcTemplate jdbc;
    private final PointsEventAwardService awards;
    @Value("${hcp.points.mq.name-server:hcp-rocketmq-namesrv:9876}") private String nameServer;
    @Value("${hcp.points.mq.topic:charge-points}") private String topic;
    @Value("${hcp.points.mq.tag:ORDER_SETTLED}") private String tag;
    @Value("${hcp.points.mq.consumer-group:charge-points-consumer}") private String group;
    @Value("${hcp.points.mq.max-consume-failures:12}") private int maxFailures;
    private DefaultMQPushConsumer consumer;
    private boolean closed;

    public PointsEventConsumer(JdbcTemplate jdbc, PointsEventAwardService awards) {
        this.jdbc=jdbc; this.awards=awards;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelayString="${hcp.points.mq.connect-retry-ms:10000}", initialDelay=10000)
    public synchronized void connect() {
        if (consumer!=null || closed) return;
        DefaultMQPushConsumer candidate=new DefaultMQPushConsumer(group);
        candidate.setNamesrvAddr(nameServer);
        // Include messages published before the group's first startup.
        candidate.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
        candidate.setConsumeThreadMin(2);
        candidate.setConsumeThreadMax(4);
        candidate.setConsumeMessageBatchMaxSize(1);
        // SQL caps business failures; database outages must not exhaust broker retries.
        candidate.setMaxReconsumeTimes(Integer.MAX_VALUE);
        candidate.registerMessageListener((MessageListenerConcurrently)(messages,context)-> {
            MessageExt message=messages.get(0);
            String id=new String(message.getBody(),StandardCharsets.UTF_8);
            try {
                if (!id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("Invalid event id");
                awards.consume(id);
                return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
            } catch (Exception ex) {
                try {
                    int recorded=recordFailure(id,ex);
                    String status=recorded==0 ? null : jdbc.queryForObject(
                        "select status from c_points_event where event_id=?",String.class,id);
                    // Unmatched or exhausted events go to the group's DLQ.
                    context.setDelayLevelWhenNextConsume(recorded==0 || "DEAD".equals(status) ? -1 : 2);
                } catch (Exception recordingError) {
                    log.error("Cannot record points failure event={}",id,recordingError);
                    context.setDelayLevelWhenNextConsume(2);
                }
                log.warn("Points consume failed event={}",id,ex);
                return ConsumeConcurrentlyStatus.RECONSUME_LATER;
            }
        });
        try {
            candidate.subscribe(topic,tag);
            candidate.start();
            consumer=candidate;
            log.info("Points RocketMQ consumer started topic={} group={}",topic,group);
        } catch (Exception ex) {
            candidate.shutdown();
            log.warn("Points RocketMQ consumer startup failed; will retry",ex);
        }
    }

    /** Autocommit statement survives rollback of the separate award transaction. */
    private int recordFailure(String id, Exception ex) {
        String error=ex.getClass().getSimpleName()+": "+ex.getMessage();
        return jdbc.update("update c_points_event set consume_failures=consume_failures+1,"
            +"status=if(consume_failures>=?,'DEAD',status),last_error=? "
            +"where event_id=? and status not in ('CONSUMED','DEAD')",maxFailures,
            error.substring(0,Math.min(500,error.length())),id);
    }

    @PreDestroy
    public synchronized void shutdown() {
        closed=true;
        if (consumer!=null) consumer.shutdown();
    }
}
