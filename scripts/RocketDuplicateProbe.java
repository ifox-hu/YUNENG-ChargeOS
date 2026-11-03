import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.apache.rocketmq.client.producer.SendResult;
import org.apache.rocketmq.client.producer.SendStatus;
import org.apache.rocketmq.common.message.Message;
import org.apache.rocketmq.common.message.MessageQueue;
import org.apache.rocketmq.common.admin.ConsumeStats;
import org.apache.rocketmq.common.admin.OffsetWrapper;
import org.apache.rocketmq.tools.admin.DefaultMQAdminExt;

/** Disposable probe: publish real messages, then verify group offsets passed every sent message. */
public class RocketDuplicateProbe {
    public static void main(String[] args) throws Exception {
        String event = args[0];
        int count = Integer.parseInt(args[1]);
        DefaultMQProducer producer = new DefaultMQProducer("resume-probe-" + System.currentTimeMillis());
        producer.setNamesrvAddr("hcp-rocketmq-namesrv:9876");
        producer.setRetryTimesWhenSendFailed(0);
        producer.setSendMsgTimeout(10000);
        DefaultMQAdminExt admin = new DefaultMQAdminExt();
        admin.setNamesrvAddr("hcp-rocketmq-namesrv:9876");
        admin.setInstanceName("resume-offset-probe-" + System.currentTimeMillis());
        Map<MessageQueue, Long> targets = new HashMap<>();
        long began = System.nanoTime();
        int successful = 0;
        try {
            producer.start();
            for (int i=0; i<count; i++) {
                SendResult result = producer.send(new Message("charge-points", "ORDER_SETTLED", event,
                    event.getBytes(StandardCharsets.UTF_8)));
                if (result.getSendStatus() != SendStatus.SEND_OK) throw new IllegalStateException(result.toString());
                successful++;
                targets.put(result.getMessageQueue(), result.getQueueOffset()+1);
            }
            double sendSeconds = (System.nanoTime()-began)/1e9;
            admin.start();
            boolean drained = false;
            long deadline = System.currentTimeMillis()+180000;
            while (System.currentTimeMillis()<deadline) {
                ConsumeStats stats = admin.examineConsumeStats("charge-points-consumer", "charge-points");
                drained = true;
                for (Map.Entry<MessageQueue, Long> target: targets.entrySet()) {
                    OffsetWrapper offset = stats.getOffsetTable().get(target.getKey());
                    if (offset==null || offset.getConsumerOffset()<target.getValue()) { drained=false; break; }
                }
                if (drained) break;
                Thread.sleep(1000);
            }
            System.out.println("{\"realMqSendOk\":"+successful+",\"consumerOffsetsReachedTargets\":"+drained
                +",\"sendSeconds\":"+sendSeconds+",\"totalSeconds\":"+((System.nanoTime()-began)/1e9)+"}");
            if (!drained) throw new IllegalStateException("Consumer offsets did not reach all sent messages");
        } finally { producer.shutdown(); admin.shutdown(); }
    }
}
