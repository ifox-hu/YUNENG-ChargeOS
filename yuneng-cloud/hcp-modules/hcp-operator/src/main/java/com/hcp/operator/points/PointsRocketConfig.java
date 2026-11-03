package com.hcp.operator.points;

import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Native RocketMQ client; delivery receipts and retries remain in the SQL outbox. */
@Configuration
@ConditionalOnProperty(name="hcp.points.mq.enabled", havingValue="true")
public class PointsRocketConfig {
    @Bean(initMethod="start", destroyMethod="shutdown")
    public DefaultMQProducer pointsProducer(
            @Value("${hcp.points.mq.name-server:hcp-rocketmq-namesrv:9876}") String nameServer,
            @Value("${hcp.points.mq.producer-group:charge-points-producer}") String group,
            @Value("${hcp.points.mq.send-timeout-ms:5000}") int timeout) {
        if (timeout < 100 || timeout > 20000) {
            throw new IllegalArgumentException("Points send timeout must be between 100 and 20000 ms (lease is 30 seconds)");
        }
        DefaultMQProducer producer = new DefaultMQProducer(group);
        producer.setNamesrvAddr(nameServer);
        producer.setSendMsgTimeout(timeout);
        producer.setRetryTimesWhenSendFailed(0);
        producer.setRetryAnotherBrokerWhenNotStoreOK(false);
        return producer;
    }
}
