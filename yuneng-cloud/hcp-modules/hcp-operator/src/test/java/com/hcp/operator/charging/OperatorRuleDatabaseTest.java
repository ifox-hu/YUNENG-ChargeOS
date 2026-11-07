package com.hcp.operator.charging;

import com.hcp.common.core.context.SecurityContextHolder;
import com.hcp.common.mybatisplus.tenant.TenantLifecycle;
import com.hcp.operator.rule.OperatorChargeRuleService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="onboarding.integration",matches="true")
class OperatorRuleDatabaseTest {
    private JdbcTemplate jdbc;
    private TransactionTemplate tx;
    private OperatorChargeRuleService rules;
    private long tenant;
    @BeforeEach void setup() {
        DriverManagerDataSource ds = new DriverManagerDataSource("jdbc:mysql://127.0.0.1:3307/vctgo_platform?useSSL=false&serverTimezone=Asia/Shanghai","root","password");
        jdbc = new JdbcTemplate(ds); tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        rules = new OperatorChargeRuleService(jdbc,mock(TenantLifecycle.class));
        tenant = 870000000L + ThreadLocalRandom.current().nextInt(10000000);
        jdbc.update("INSERT INTO c_operator_charge_rule(tenant_id) VALUES(?)",tenant);
    }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM c_operator_charge_whitelist WHERE tenant_id=?",tenant);
        jdbc.update("DELETE FROM c_operator_charge_rule WHERE tenant_id=?",tenant);
        SecurityContextHolder.remove();
    }
    private void identity() { SecurityContextHolder.setUserId("42"); SecurityContextHolder.setTenantId(String.valueOf(tenant)); }
    @Test void activeTenantDateFromRealDriverAllowsLogin() {
        jdbc.update("INSERT INTO sys_tenant(id,tenant_name,status,del_flag,tenant_time) VALUES(?,'lifecycle-test','0','0',DATE_ADD(NOW(),INTERVAL 1 DAY))",tenant);
        try {
            assertDoesNotThrow(() -> new TenantLifecycle(jdbc,false).requireActive(tenant));
        } finally {jdbc.update("DELETE FROM sys_tenant WHERE id=?",tenant);}
    }
    @Test void foreignMemberCannotCreateReportForAnotherTenantDevice() {
        String pile = "QA_SCOPE_"+tenant;
        long member = tenant;
        jdbc.update("INSERT INTO c_member(member_id,user_name,tenant_id) VALUES(?,'scope-test',?)",member,tenant+1);
        jdbc.update("INSERT INTO c_charging_pile(pile_id,name,tenant_id,deleted) VALUES(?,'scope-test',?,0)",pile,tenant);
        com.hcp.operator.service.FaultTicketService service = new com.hcp.operator.service.FaultTicketService();
        org.springframework.test.util.ReflectionTestUtils.setField(service,"jdbc",jdbc);
        com.hcp.system.api.domain.FaultRequest request = new com.hcp.system.api.domain.FaultRequest();
        request.setPileId(pile);request.setFaultType("POWER");request.setDescription("foreign report");
        try {
            assertThrows(com.hcp.common.core.exception.ServiceException.class, () -> tx.execute(s -> service.create(request,member,null)));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM c_fault_ticket WHERE pile_id=?",Integer.class,pile));
        } finally {
            jdbc.update("DELETE FROM c_fault_report WHERE ticket_id IN(SELECT id FROM c_fault_ticket WHERE pile_id=?)",pile);
            jdbc.update("DELETE FROM c_fault_ticket_log WHERE ticket_id IN(SELECT id FROM c_fault_ticket WHERE pile_id=?)",pile);
            jdbc.update("DELETE FROM c_fault_ticket WHERE pile_id=?",pile);
            jdbc.update("DELETE FROM c_charging_pile WHERE pile_id=?",pile);
            jdbc.update("DELETE FROM c_member WHERE member_id=?",member);
        }
    }
    @Test void concurrentSameVersionOnlyOneWriterSucceeds() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2), go = new CountDownLatch(1);
        Callable<Boolean> writer = () -> { identity(); ready.countDown(); go.await();
            try { tx.execute(s -> {rules.update(null,2,false,0L); return null;}); return true; }
            catch (com.hcp.common.core.exception.ServiceException ex) {return false;}
            finally {SecurityContextHolder.remove();}
        };
        try {
            Future<Boolean> a = pool.submit(writer), b = pool.submit(writer);
            assertTrue(ready.await(5,TimeUnit.SECONDS)); go.countDown();
            assertNotEquals(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS));
            assertEquals(1L,jdbc.queryForObject("SELECT version FROM c_operator_charge_rule WHERE tenant_id=?",Long.class,tenant));
        } finally {pool.shutdownNow();}
    }
    @Test void sharedStartsOverlapAndConfigurationWaitsUntilBothCommit() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(3);
        CountDownLatch readers = new CountDownLatch(2), release = new CountDownLatch(1), writerStarted = new CountDownLatch(1);
        Callable<Boolean> reader = () -> tx.execute(status -> {
            rules.validateStart(tenant,1L,1); readers.countDown();
            try { if (!release.await(5,TimeUnit.SECONDS)) throw new AssertionError("reader release timed out"); }
            catch (InterruptedException ex) {throw new RuntimeException(ex);} return true;
        });
        try {
            Future<Boolean> a = pool.submit(reader), b = pool.submit(reader);
            assertTrue(readers.await(5,TimeUnit.SECONDS),"Shared reads must not serialize independent starts");
            Future<?> writer = pool.submit(() -> { identity(); writerStarted.countDown();
                try {tx.execute(s -> {rules.update(null,2,true,0L); return null;});}
                finally {SecurityContextHolder.remove();}
            });
            assertTrue(writerStarted.await(2,TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> writer.get(200,TimeUnit.MILLISECONDS));
            release.countDown(); assertTrue(a.get(5,TimeUnit.SECONDS)); assertTrue(b.get(5,TimeUnit.SECONDS)); writer.get(5,TimeUnit.SECONDS);
            assertThrows(com.hcp.common.core.exception.ServiceException.class, () -> tx.execute(s -> {rules.validateStart(tenant,1L,1); return null;}));
        } finally {release.countDown();pool.shutdownNow();}
    }
    @Test void ruleAndWhitelistEditsCannotBothUseOneVersion() throws Exception {
        jdbc.update("INSERT INTO c_member(member_id,user_name,tenant_id) VALUES(?,'rule-version-test',?)",tenant,tenant);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        CountDownLatch ready=new CountDownLatch(2),go=new CountDownLatch(1);
        java.util.function.Function<Boolean,Callable<Boolean>> edit=whitelist -> () -> {
            identity();ready.countDown();go.await();
            try {
                tx.execute(s -> {if(whitelist)rules.changeMember(null,tenant,true,0L);else rules.update(null,2,true,0L);return null;});
                return true;
            } catch(com.hcp.common.core.exception.ServiceException conflict) {return false;}
            finally {SecurityContextHolder.remove();}
        };
        try {
            Future<Boolean> config=pool.submit(edit.apply(false)),member=pool.submit(edit.apply(true));
            assertTrue(ready.await(5,TimeUnit.SECONDS));go.countDown();
            boolean configWon=config.get(10,TimeUnit.SECONDS),memberWon=member.get(10,TimeUnit.SECONDS);
            assertNotEquals(configWon,memberWon);
            assertEquals(1L,jdbc.queryForObject("SELECT version FROM c_operator_charge_rule WHERE tenant_id=?",Long.class,tenant));
            assertEquals(memberWon?1L:0L,jdbc.queryForObject("SELECT COUNT(*) FROM c_operator_charge_whitelist WHERE tenant_id=?",Long.class,tenant));
        } finally {
            go.countDown();pool.shutdownNow();
            jdbc.update("DELETE FROM c_operator_charge_whitelist WHERE tenant_id=?",tenant);
            jdbc.update("DELETE FROM c_member WHERE member_id=?",tenant);
        }
    }
}
