package com.hcp.operator.alarm;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.junit.jupiter.api.Assertions.*;

class DeviceAlarmMqConfigTest {
    @Test void disabledByDefaultDoesNotRequireBrokerOrStartClients() {
        new ApplicationContextRunner().withUserConfiguration(DeviceAlarmMqConfig.class,
            DeviceAlarmPublisher.class,DeviceAlarmConsumer.class).run(context->{
                assertNull(context.getStartupFailure());
                assertFalse(context.getBean(DeviceAlarmMqConfig.class).isEnabled());
                assertTrue(context.getBeansOfType(DeviceAlarmPublisher.class).isEmpty());
                assertTrue(context.getBeansOfType(DeviceAlarmConsumer.class).isEmpty());
            });
    }
    @Test void invalidLeaseAndConsumerLimitsAreRejected() {
        DeviceAlarmMqConfig c=new DeviceAlarmMqConfig();assertDoesNotThrow(c::validate);
        c.setLeaseSeconds(3);assertThrows(IllegalArgumentException.class,c::validate);
        c.setLeaseSeconds(30);c.setConsumerThreads(0);assertThrows(IllegalArgumentException.class,c::validate);
    }
}
