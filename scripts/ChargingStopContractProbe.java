import com.hcp.operator.charging.ChargingDeviceStrategies;
import com.hcp.operator.charging.ChargingDeviceStrategy;
import com.hcp.operator.mapper.*;
import com.hcp.operator.service.IChargingOrderService;
import com.hcp.operator.service.impl.ChargingOrderServiceImpl;
import com.hcp.system.api.RemoteChargingService;
import com.hcp.system.api.domain.*;
import java.lang.reflect.*;
import java.util.Collections;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.annotation.ImportCandidates;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.*;

/** Behavioral regression probes against the compiled production classes, without a DB/server. */
public class ChargingStopContractProbe {
    interface Answer { Object call(Method method, Object[] args) throws Throwable; }
    static <T> T mapper(Class<T> type, Answer answer) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
            (p,m,a) -> { if(m.getDeclaringClass()==Object.class) return m.getName().equals("toString")?type.getName():null; return answer.call(m,a); }));
    }
    static void set(Object target, String name, Object value) throws Exception {
        Field f=target.getClass().getDeclaredField(name); f.setAccessible(true); f.set(target,value);
    }
    static void fallback() throws Exception {
        Class<?> factoryType=RemoteChargingService.class.getAnnotation(FeignClient.class).fallbackFactory();
        Object fallback=((FallbackFactory<?>)factoryType.newInstance()).create(new IllegalStateException("probe timeout"));
        if(!RemoteChargingService.class.isInstance(fallback)) throw new AssertionError("Configured fallback factory returns "+fallback.getClass()+", not RemoteChargingService");
        if(((RemoteChargingService)fallback).stopCharge("probe","1").getCode()!=500) throw new AssertionError("fallback must return a business failure");
        System.out.println("PASS Feign fallback returns the declared client interface and a failure response");
    }
    static void registration() throws Exception {
        try(AnnotationConfigApplicationContext context=new AnnotationConfigApplicationContext()){
            for(String candidate:ImportCandidates.load(AutoConfiguration.class,RemoteChargingService.class.getClassLoader())){
                if(candidate.startsWith("com.hcp.system.api.factory.")) context.register(Class.forName(candidate));
            }
            context.refresh();
            Class<?> type=RemoteChargingService.class.getAnnotation(FeignClient.class).fallbackFactory();
            Object bean=context.getBean(type);
            Object result=((FallbackFactory<?>)bean).create(new IllegalStateException("probe timeout"));
            if(!RemoteChargingService.class.isInstance(result))throw new AssertionError("registered factory has incompatible result");
            System.out.println("PASS Boot auto-configuration imports register the configured fallback bean");
        }
    }
    static void stop() throws Exception {
        ChargingOrderServiceImpl target=new ChargingOrderServiceImpl();
        ChargingPort port=new ChargingPort(); port.setPortId(1L); port.setTenantId(9999L);
        ChargingPile pile=new ChargingPile(); pile.setDeviceType(4L);
        ChargingOrder order=new ChargingOrder(); order.setOrderNumber("probe-order");
        final int[] logWrites={0},rpcCalls={0};
        set(target,"chargingPortMapper",mapper(ChargingPortMapper.class,(m,a)->port));
        set(target,"chargingPileMapper",mapper(ChargingPileMapper.class,(m,a)->pile));
        set(target,"chargingOrderMapper",mapper(ChargingOrderMapper.class,(m,a)->order));
        set(target,"orderLogMapper",mapper(OrderLogMapper.class,(m,a)->{logWrites[0]++;return 1;}));
        ChargingDeviceStrategy strategy=new ChargingDeviceStrategy(){
            public Long deviceType(){return 4L;} public void prepare(String p){} public void start(ChargingOrder o){}
            public void stop(String p,String devicePort){
                rpcCalls[0]++;
                if(TransactionSynchronizationManager.isActualTransactionActive()) throw new AssertionError("Stop RPC holds an active DB transaction while simulator callback needs another connection");
                if(logWrites[0]!=1) throw new AssertionError("stop request must be logged before RPC");
            }
        };
        set(target,"chargingDeviceStrategies",new ChargingDeviceStrategies(Collections.singletonList(strategy)));
        AbstractPlatformTransactionManager tx=new AbstractPlatformTransactionManager(){
            protected Object doGetTransaction(){return new Object();}
            protected void doBegin(Object t,TransactionDefinition d){}
            protected void doCommit(DefaultTransactionStatus s){}
            protected void doRollback(DefaultTransactionStatus s){}
        };
        ProxyFactory factory=new ProxyFactory(target);
        factory.addAdvice(new TransactionInterceptor(tx,new AnnotationTransactionAttributeSource()));
        ((IChargingOrderService)factory.getProxy()).stopChargingOrder("probe","1");
        if(rpcCalls[0]!=1 || logWrites[0]!=1) throw new AssertionError("expected one log write and one real service dispatch");
        System.out.println("PASS stop service logs request and invokes strategy outside a DB transaction");
    }
    public static void main(String[] args) throws Exception {
        if(args[0].equals("fallback")) fallback(); else if(args[0].equals("registration"))registration(); else stop();
    }
}
