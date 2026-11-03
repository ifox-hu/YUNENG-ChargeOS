package com.hcp.operator.alarm;

import javax.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Separate alarm client lifecycle avoids changing existing points producer injection. */
@Data
@Component
@ConfigurationProperties(prefix="hcp.alarm.mq")
public class DeviceAlarmMqConfig {
    private boolean enabled=false;
    private String nameServer="hcp-rocketmq-namesrv:9876";
    private String topic="charge-device-alarm";
    private String producerGroup="charge-device-alarm-producer";
    private String consumerGroup="charge-device-alarm-consumer";
    private int sendTimeoutMs=3000,leaseSeconds=30,receiptTimeoutSeconds=120;
    private int batchSize=100,maxAttempts=12,maxConsumeFailures=12,consumerThreads=4;
    @PostConstruct public void validate(){
        if(sendTimeoutMs<100 || sendTimeoutMs>20000 || leaseSeconds*1000L<=sendTimeoutMs+1000L
            || leaseSeconds>300 || receiptTimeoutSeconds<10 || batchSize<1 || batchSize>1000
            || maxAttempts<1 || maxConsumeFailures<1 || consumerThreads<1 || consumerThreads>16)
            throw new IllegalArgumentException("Invalid alarm MQ timeouts, lease, batch size or retry/thread limits");
    }
}
