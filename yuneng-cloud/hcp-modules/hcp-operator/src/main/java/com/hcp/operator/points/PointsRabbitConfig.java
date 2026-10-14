package com.hcp.operator.points;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topology for the charge points pipeline.
 *
 * <p>Declarations are idempotent, so publisher and consumer may start in either order and the
 * topology exists before the first settlement is published. The award queue dead-letters into a
 * TTL retry queue, so a failed award returns to the award queue after the configured retry TTL.
 * Retry counts live in c_points_event instead of the broker, so the database stays the authority on
 * when an event is dead. Messages that no retry can repair are parked on the DLX rather than
 * looping.</p>
 */
@Configuration
@ConditionalOnProperty(name="hcp.points.mq.enabled", havingValue="true")
public class PointsRabbitConfig {
    /** Dead letter exchange for failed awards and for messages parked for inspection. */
    public static final String DLX = "charge.points.dlx";
    /** Routing key of the delayed retry queue behind the DLX. */
    public static final String RETRY_ROUTING_KEY = "charge.points.award.retry";
    /** Routing key of the parking queue for messages no retry can repair. */
    public static final String PARKED_ROUTING_KEY = "charge.points.award.parked";

    @Value("${hcp.points.mq.exchange:charge.points.exchange}") private String exchange;
    @Value("${hcp.points.mq.queue:charge.points.award.queue}") private String queue;
    @Value("${hcp.points.mq.routing-key:charge.points.order.settled}") private String routingKey;
    @Value("${hcp.points.mq.retry-ttl-ms:5000}") private int retryTtl;

    @Bean
    public DirectExchange chargePointsExchange() { return new DirectExchange(exchange, true, false); }

    @Bean
    public DirectExchange chargePointsDlxExchange() { return new DirectExchange(DLX, true, false); }

    @Bean
    public Queue chargePointsAwardQueue() {
        return QueueBuilder.durable(queue)
            .deadLetterExchange(DLX).deadLetterRoutingKey(RETRY_ROUTING_KEY).build();
    }

    @Bean
    public Queue chargePointsRetryQueue() {
        // TTL expiry dead-letters the same message back onto the award routing key.
        return QueueBuilder.durable(queue + ".retry")
            .withArgument("x-message-ttl", retryTtl)
            .withArgument("x-dead-letter-exchange", exchange)
            .withArgument("x-dead-letter-routing-key", routingKey).build();
    }

    @Bean
    public Queue chargePointsParkedQueue() { return QueueBuilder.durable(queue + ".parked").build(); }

    @Bean
    public Binding chargePointsAwardBinding(Queue chargePointsAwardQueue, DirectExchange chargePointsExchange) {
        return BindingBuilder.bind(chargePointsAwardQueue).to(chargePointsExchange).with(routingKey);
    }

    @Bean
    public Binding chargePointsRetryBinding(Queue chargePointsRetryQueue, DirectExchange chargePointsDlxExchange) {
        return BindingBuilder.bind(chargePointsRetryQueue).to(chargePointsDlxExchange).with(RETRY_ROUTING_KEY);
    }

    @Bean
    public Binding chargePointsParkedBinding(Queue chargePointsParkedQueue, DirectExchange chargePointsDlxExchange) {
        return BindingBuilder.bind(chargePointsParkedQueue).to(chargePointsDlxExchange).with(PARKED_ROUTING_KEY);
    }
}
