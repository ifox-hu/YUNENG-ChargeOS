import java.nio.charset.StandardCharsets;
import java.util.*;
import org.apache.rocketmq.client.producer.*;
import org.apache.rocketmq.common.message.*;
import org.apache.rocketmq.common.admin.*;
import org.apache.rocketmq.tools.admin.DefaultMQAdminExt;

/** Real messages plus target consumer offsets, not simulated consumer calls. */
public class AlarmDuplicateProbe {
    public static void main(String[] args)throws Exception {
        long id=Long.parseLong(args[0]);int count=Integer.parseInt(args[1]);
        if(id<=0||count<1||count>100000)throw new IllegalArgumentException("Invalid probe size");
        DefaultMQProducer producer=new DefaultMQProducer("alarm-probe-"+System.currentTimeMillis());
        producer.setNamesrvAddr("hcp-rocketmq-namesrv:9876");producer.setRetryTimesWhenSendFailed(0);producer.setSendMsgTimeout(10000);
        DefaultMQAdminExt admin=new DefaultMQAdminExt();admin.setNamesrvAddr("hcp-rocketmq-namesrv:9876");admin.setInstanceName("alarm-probe-admin-"+System.currentTimeMillis());
        Map<MessageQueue,Long> targets=new HashMap<>();long began=System.nanoTime();int sent=0;
        try{
            producer.start();
            for(int i=0;i<count;i++){
                SendResult result=producer.send(new Message("charge-device-alarm","DEVICE_ALARM",String.valueOf(id),String.valueOf(id).getBytes(StandardCharsets.UTF_8)));
                if(result.getSendStatus()!=SendStatus.SEND_OK)throw new IllegalStateException(result.toString());
                sent++;targets.put(result.getMessageQueue(),result.getQueueOffset()+1);
            }
            admin.start();boolean drained=false;long deadline=System.currentTimeMillis()+180000;
            while(System.currentTimeMillis()<deadline){
                ConsumeStats stats=admin.examineConsumeStats("charge-device-alarm-consumer","charge-device-alarm");drained=true;
                for(Map.Entry<MessageQueue,Long> t:targets.entrySet()){
                    OffsetWrapper o=stats.getOffsetTable().get(t.getKey());if(o==null||o.getConsumerOffset()<t.getValue()){drained=false;break;}
                }
                if(drained)break;Thread.sleep(1000);
            }
            System.out.println("{\"realMessagesSent\":"+sent+",\"allTargetOffsetsConsumed\":"+drained+",\"seconds\":"+((System.nanoTime()-began)/1e9)+"}");
            if(!drained)throw new IllegalStateException("Alarm consumer offsets did not drain");
        }finally{producer.shutdown();admin.shutdown();}
    }
}
