package com.hcp.mp.service;

import java.nio.charset.StandardCharsets;
import javax.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.amqp.rabbit.listener.api.ChannelAwareMessageListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import com.hcp.mp.config.PointsRabbitConfig;

/**
 * Points consumer on RabbitMQ.
 *
 * <p>A failed award is never requeued onto the live queue: the award queue dead-letters into a TTL
 * retry queue, so redelivery is delayed instead of spinning hot, and the durable failure counter in
 * c_points_event stays the authority on when the event is dead. Messages that no retry can repair
 * are parked instead of looping.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name="hcp.points.mq.enabled", havingValue="true")
public class PointsEventConsumer {
    private final JdbcTemplate jdbc;
    private final PointsEventAwardService awards;
    private final ConnectionFactory connectionFactory;
    private final RabbitTemplate rabbit;
    @Value("${hcp.points.mq.queue:charge.points.award.queue}") private String queue;
    @Value("${hcp.points.mq.max-consume-failures:12}") private int maxFailures;
    private SimpleMessageListenerContainer container;

    public PointsEventConsumer(JdbcTemplate jdbc, PointsEventAwardService awards,
                               ConnectionFactory connectionFactory, RabbitTemplate rabbit) {
        this.jdbc = jdbc; this.awards = awards; this.connectionFactory = connectionFactory; this.rabbit = rabbit;
    }

    /**
     * Started on ApplicationReadyEvent so the broker declarations from RabbitAdmin exist first;
     * starting in PostConstruct races the declarations and the broker answers 404 NOT_FOUND.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void connect() {
        container = new SimpleMessageListenerContainer(connectionFactory);
        container.setQueueNames(queue);
        container.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        container.setConcurrentConsumers(2);
        container.setMaxConcurrentConsumers(4);
        container.setPrefetchCount(1);
        // A rejected message must never hot-loop; the dead-letter TTL queue owns the delay.
        container.setDefaultRequeueRejected(false);
        // The broker may start after this service, or the admin may declare the queue slightly
        // later: keep retrying instead of failing application startup.
        container.setMissingQueuesFatal(false);
        container.setMessageListener((ChannelAwareMessageListener) this::onMessage);
        try {
            container.start();
            log.info("Points MQ consumer connected to queue {}", queue);
        } catch (Exception ex) {
            // Broker start order must not stop the application; the container reconnects on its own.
            log.warn("Points MQ consumer will retry connection to queue {}", queue, ex);
        }
    }

    private void onMessage(Message message, com.rabbitmq.client.Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        String id = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            if (!id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("Invalid event id");
            awards.consume(id);
            channel.basicAck(deliveryTag, false);
        } catch (Exception ex) {
            int recorded;
            try {
                recorded = recordFailure(id, ex);
            } catch (Exception recordingError) {
                // The database is unreachable, so the failure cannot be counted: keep the message.
                log.error("Cannot record points failure event={}", id, recordingError);
                channel.basicNack(deliveryTag, false, true);
                return;
            }
            if (recorded == 0) {
                // Unknown or already terminal event: no retry can repair it, so park it for review.
                park(id, ex);
                channel.basicAck(deliveryTag, false);
                return;
            }
            // Dead-letter through the TTL retry queue; c_points_event caps the failure count.
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /** Runs in its own autocommit statement, so the count survives the award rollback. */
    private int recordFailure(String id, Exception ex) {
        String error = ex.getClass().getSimpleName() + ": " + ex.getMessage();
        return jdbc.update("update c_points_event set consume_failures=consume_failures+1,"
            + "status=if(consume_failures>=?,'DEAD',status),last_error=? "
            + "where event_id=? and status not in ('CONSUMED','DEAD')", maxFailures,
            error.substring(0, Math.min(500, error.length())), id);
    }

    private void park(String id, Exception cause) {
        try {
            MessageProperties props = new MessageProperties();
            props.setContentType(MessageProperties.CONTENT_TYPE_TEXT_PLAIN);
            props.setMessageId(id);
            props.setHeader("parked_reason", cause.getClass().getSimpleName());
            rabbit.send(PointsRabbitConfig.DLX, PointsRabbitConfig.PARKED_ROUTING_KEY,
                new Message(id.getBytes(StandardCharsets.UTF_8), props));
            log.warn("Points message parked event={} reason={}", id, cause.toString());
        } catch (Exception parkError) {
            log.error("Cannot park points message event={}", id, parkError);
        }
    }

    @PreDestroy
    public void shutdown() { if (container != null) container.stop(); }
}
