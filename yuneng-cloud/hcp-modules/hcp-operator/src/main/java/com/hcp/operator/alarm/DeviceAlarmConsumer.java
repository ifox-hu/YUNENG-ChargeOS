package com.hcp.operator.alarm;

import java.nio.charset.StandardCharsets;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.consumer.DefaultMQPushConsumer;
import org.apache.rocketmq.client.consumer.listener.*;
import org.apache.rocketmq.common.consumer.ConsumeFromWhere;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j @Component
@ConditionalOnProperty(name="hcp.alarm.mq.enabled",havingValue="true")
public class DeviceAlarmConsumer {
    private final DeviceAlarmMqConfig config;private final DeviceAlarmProcessor processor;private final DeviceAlarmDelivery delivery;
    private DefaultMQPushConsumer consumer;private boolean closed;
    public DeviceAlarmConsumer(DeviceAlarmMqConfig config,DeviceAlarmProcessor processor,DeviceAlarmDelivery delivery){this.config=config;this.processor=processor;this.delivery=delivery;}
    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelayString="${hcp.alarm.mq.connect-retry-ms:10000}",initialDelay=10000)
    public synchronized void connect(){
        if(consumer!=null||closed)return;
        DefaultMQPushConsumer candidate=new DefaultMQPushConsumer(config.getConsumerGroup());
        candidate.setInstanceName("alarm-consumer");candidate.setNamesrvAddr(config.getNameServer());
        candidate.setConsumeFromWhere(ConsumeFromWhere.CONSUME_FROM_FIRST_OFFSET);
        candidate.setConsumeThreadMin(config.getConsumerThreads());candidate.setConsumeThreadMax(config.getConsumerThreads());
        candidate.setConsumeMessageBatchMaxSize(1);candidate.setMaxReconsumeTimes(Integer.MAX_VALUE);
        candidate.registerMessageListener((MessageListenerConcurrently)(messages,context)->
            consume(new String(messages.get(0).getBody(),StandardCharsets.UTF_8),context));
        try{candidate.subscribe(config.getTopic(),"DEVICE_ALARM");candidate.start();consumer=candidate;log.info("Alarm consumer started topic={}",config.getTopic());}
        catch(Exception ex){candidate.shutdown();log.warn("Alarm consumer connection failed; will retry",ex);}
    }
    public ConsumeConcurrentlyStatus consume(String text,ConsumeConcurrentlyContext context){
            long id;
            try{if(!text.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException("Invalid alarm event id");id=Long.parseLong(text);}
            catch(Exception ex){log.error("Malformed alarm message");context.setDelayLevelWhenNextConsume(-1);return ConsumeConcurrentlyStatus.RECONSUME_LATER;}
            Long generation=null;
            try{generation=delivery.generation(id);processor.process(id);return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;}
            catch(DeviceAlarmProcessor.UnknownEventException ex){
                log.error("Unknown alarm message id={}; send to dead letter queue",id);
                context.setDelayLevelWhenNextConsume(-1);return ConsumeConcurrentlyStatus.RECONSUME_LATER;
            }
            catch(Exception ex){
                try{if(generation!=null)delivery.consumeFailed(id,generation,config.getMaxConsumeFailures(),ex.getClass().getSimpleName()+": "+ex.getMessage());}
                catch(Exception recordingError){log.error("Could not persist alarm failure id={}",id,recordingError);}
                context.setDelayLevelWhenNextConsume(2);log.warn("Alarm processing failed id={}",id,ex);return ConsumeConcurrentlyStatus.RECONSUME_LATER;
            }
    }
    @PreDestroy public synchronized void shutdown(){closed=true;if(consumer!=null)consumer.shutdown();}
}
