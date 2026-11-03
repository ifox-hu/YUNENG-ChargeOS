package com.hcp.operator.alarm;

import java.lang.reflect.*;
import org.junit.jupiter.api.Test;
import org.apache.rocketmq.client.consumer.listener.*;
import org.apache.rocketmq.common.message.MessageQueue;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DeviceAlarmConsumerTest {
    private ConsumeConcurrentlyStatus consume(DeviceAlarmConsumer consumer,String body,ConsumeConcurrentlyContext ctx)throws Throwable{
        Method method;
        try{method=DeviceAlarmConsumer.class.getMethod("consume",String.class,ConsumeConcurrentlyContext.class);}
        catch(NoSuchMethodException ex){throw new AssertionError("Explicit malformed/unknown message handling is missing",ex);}
        try{return (ConsumeConcurrentlyStatus)method.invoke(consumer,body,ctx);}catch(InvocationTargetException ex){throw ex.getCause();}
    }
    @Test void malformedMessageGoesToDeadLetterInsteadOfInfiniteRetry()throws Throwable{
        DeviceAlarmConsumer c=new DeviceAlarmConsumer(new DeviceAlarmMqConfig(),mock(DeviceAlarmProcessor.class),mock(DeviceAlarmDelivery.class));
        ConsumeConcurrentlyContext ctx=new ConsumeConcurrentlyContext(new MessageQueue());
        assertEquals(ConsumeConcurrentlyStatus.RECONSUME_LATER,consume(c,"bad-id",ctx));assertEquals(-1,ctx.getDelayLevelWhenNextConsume());
    }
    @Test void databaseFailureIsRetriedNotAcknowledged()throws Throwable{
        DeviceAlarmProcessor p=mock(DeviceAlarmProcessor.class);doThrow(new IllegalStateException("database unavailable")).when(p).process(12L);
        DeviceAlarmConsumer c=new DeviceAlarmConsumer(new DeviceAlarmMqConfig(),p,mock(DeviceAlarmDelivery.class));
        ConsumeConcurrentlyContext ctx=new ConsumeConcurrentlyContext(new MessageQueue());
        assertEquals(ConsumeConcurrentlyStatus.RECONSUME_LATER,consume(c,"12",ctx));assertEquals(2,ctx.getDelayLevelWhenNextConsume());
    }
    @Test void failureRecordingCarriesGenerationObservedBeforeProcessing()throws Throwable{
        DeviceAlarmProcessor p=mock(DeviceAlarmProcessor.class);DeviceAlarmDelivery d=mock(DeviceAlarmDelivery.class);
        when(d.generation(12L)).thenReturn(7L);
        doThrow(new IllegalStateException("injected failure")).when(p).process(12L);
        DeviceAlarmConsumer c=new DeviceAlarmConsumer(new DeviceAlarmMqConfig(),p,d);
        consume(c,"12",new ConsumeConcurrentlyContext(new MessageQueue()));
        verify(d).consumeFailed(eq(12L),eq(7L),anyInt(),contains("injected failure"));
    }
    @Test void unknownEventGoesToDeadLetter()throws Throwable{
        Class<?> type;
        try{type=Class.forName("com.hcp.operator.alarm.DeviceAlarmProcessor$UnknownEventException");}
        catch(ClassNotFoundException ex){throw new AssertionError("Unknown events still retry without a terminal decision",ex);}
        DeviceAlarmProcessor p=mock(DeviceAlarmProcessor.class);doThrow((RuntimeException)type.getConstructor().newInstance()).when(p).process(12L);
        DeviceAlarmConsumer c=new DeviceAlarmConsumer(new DeviceAlarmMqConfig(),p,mock(DeviceAlarmDelivery.class));
        ConsumeConcurrentlyContext ctx=new ConsumeConcurrentlyContext(new MessageQueue());
        assertEquals(ConsumeConcurrentlyStatus.RECONSUME_LATER,consume(c,"12",ctx));assertEquals(-1,ctx.getDelayLevelWhenNextConsume());
    }
}
