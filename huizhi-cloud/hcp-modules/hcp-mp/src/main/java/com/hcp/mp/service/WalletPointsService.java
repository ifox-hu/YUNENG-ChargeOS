package com.hcp.mp.service;

import com.hcp.common.core.exception.ServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class WalletPointsService {
    private final JdbcTemplate jdbc;
    private final ZoneId zone = ZoneId.of("Asia/Shanghai");
    @Value("${hcp.wallet.local-recharge.enabled:false}") private boolean localRechargeEnabled;

    public WalletPointsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private Map<String,Object> one(String sql, Object... args) {
        List<Map<String,Object>> rows = jdbc.queryForList(sql,args);
        return rows.isEmpty() ? new LinkedHashMap<>() : new LinkedHashMap<>(rows.get(0));
    }
    private long member(long id) {
        Integer n = jdbc.queryForObject("select count(*) from c_member where member_id=?", Integer.class,id);
        if (n == null || n == 0) throw new ServiceException("会员不存在");
        return id;
    }
    private BigDecimal balance(long id) {
        List<BigDecimal> vals = jdbc.query("select amount from c_menber_balance where member_id=? order by id limit 2",(rs,n)->rs.getBigDecimal(1),id);
        if (vals.size()>1) throw new ServiceException("余额账户数据异常，请联系管理员");
        if (vals.isEmpty()) { jdbc.update("insert into c_menber_balance(member_id,amount,create_time,update_time,version) values(?,0,now(),now(),1)",id); return BigDecimal.ZERO; }
        return vals.get(0)==null?BigDecimal.ZERO:vals.get(0);
    }
    public Map<String,Object> wallet(long id) { member(id); Map<String,Object> r=one("select member_id,amount,update_time from c_menber_balance where member_id=? order by id limit 1",id); if(r.isEmpty()){r.put("member_id",id);r.put("amount",BigDecimal.ZERO);} return r; }
    public List<Map<String,Object>> walletLedger(long id,int page,int size) { member(id); int off=Math.max(0,page-1)*Math.min(size,50); return jdbc.queryForList("select type,amount,balance_after,remark,create_time,request_id from c_member_balance_ledger where member_id=? order by id desc limit ? offset ?",id,Math.min(size,50),off); }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> recharge(long id, BigDecimal amount, String requestId) {
        member(id); if(!localRechargeEnabled) throw new ServiceException("本地模拟充值未开启");
        boolean allowed = amount != null && (amount.compareTo(new BigDecimal("10")) == 0 || amount.compareTo(new BigDecimal("20")) == 0 || amount.compareTo(new BigDecimal("50")) == 0 || amount.compareTo(new BigDecimal("100")) == 0);
        if(!allowed) throw new ServiceException("仅支持10、20、50、100元模拟充值");
        if(requestId==null || requestId.length()>80) throw new ServiceException("充值请求号无效");
        List<Map<String,Object>> old=jdbc.queryForList("select amount,balance_after from c_member_balance_ledger where member_id=? and request_id=?",id,requestId);
        if(!old.isEmpty()) return new LinkedHashMap<String,Object>(){{put("amount",old.get(0).get("balance_after"));put("idempotent",true);}};
        jdbc.queryForObject("select member_id from c_menber_balance where member_id=? for update",Long.class,id);
        BigDecimal current=balance(id), next=current.add(amount).setScale(6,RoundingMode.HALF_UP);
        jdbc.update("update c_menber_balance set amount=?,update_time=now(),version=coalesce(version,1)+1 where member_id=?",next,id);
        jdbc.update("insert into c_member_balance_ledger(member_id,request_id,type,amount,balance_after,remark) values(?,?,?, ?,?,?)",id,requestId,"LOCAL_RECHARGE",amount,next,"本地模拟充值");
        return new LinkedHashMap<String,Object>(){{put("amount",next);put("idempotent",false);}};
    }
    public Map<String,Object> points(long id) { member(id); ensurePoints(id); return one("select member_id,credit from c_user_credit where member_id=?",id); }
    private void ensurePoints(long id) { List<Map<String,Object>> x=jdbc.queryForList("select id from c_user_credit where member_id=? limit 1",id); if(x.isEmpty()){String open="ACCOUNT_"+id; jdbc.update("insert into c_user_credit(user_id,open_id,credit,member_id) values(null,?,?,?)",open,0,id);} }
    public List<Map<String,Object>> pointsLedger(long id,int page,int size) { member(id); ensurePoints(id); int off=Math.max(page-1,0)*Math.min(size,50); return jdbc.queryForList("select type,points,balance_after,remark,create_time,business_key from c_member_points_ledger where member_id=? order by id desc limit ? offset ?",id,Math.min(size,50),off); }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> sign(long id) { member(id); ensurePoints(id); String day=LocalDate.now(zone).toString(), key="SIGN:"+day; List<Map<String,Object>> e=jdbc.queryForList("select balance_after from c_member_points_ledger where member_id=? and business_key=?",id,key); if(!e.isEmpty()) return new LinkedHashMap<String,Object>(){{put("signed",true);put("points",e.get(0).get("balance_after"));put("already",true);}}; jdbc.queryForObject("select id from c_user_credit where member_id=? for update",Long.class,id); int cur=jdbc.queryForObject("select credit from c_user_credit where member_id=?",Integer.class,id); int next=cur+5; jdbc.update("update c_user_credit set credit=? where member_id=?",next,id); jdbc.update("insert into c_member_points_ledger(member_id,business_key,type,points,balance_after,remark) values(?,?,?,?,?,?)",id,key,"DAILY_SIGN",5,next,"每日签到"); return new LinkedHashMap<String,Object>(){{put("signed",true);put("points",next);put("already",false);}}; }
    public List<Map<String,Object>> eligibleOrders(long id) { member(id); return jdbc.queryForList("select order_id,order_number,ordergold,pay_time,create_time from c_charging_order where user_id=? and order_state='3' and pay_time is not null and cast(ordergold as decimal(18,2))>0 and not exists (select 1 from c_member_points_ledger p where p.member_id=? and p.business_key=concat('ORDER:',order_id)) order by pay_time desc limit 20",id,id); }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Map<String,Object> claimOrder(long id,String orderId) { member(id); if(orderId==null||orderId.length()>64) throw new ServiceException("订单号无效"); Map<String,Object> o=one("select order_id,ordergold from c_charging_order where order_id=? and user_id=? and order_state='3' and pay_time is not null",orderId,id); if(o.isEmpty()) throw new ServiceException("订单不存在或尚未完成"); BigDecimal fee; try{fee=new BigDecimal(String.valueOf(o.get("ordergold"))).setScale(2,RoundingMode.DOWN);}catch(Exception ex){throw new ServiceException("订单金额无效");} int add=fee.intValue(); if(add<=0) throw new ServiceException("该订单暂无可领取积分"); ensurePoints(id); String key="ORDER:"+orderId; List<Map<String,Object>> e=jdbc.queryForList("select balance_after from c_member_points_ledger where member_id=? and business_key=?",id,key); if(!e.isEmpty()) return new LinkedHashMap<String,Object>(){{put("points",e.get(0).get("balance_after"));put("already",true);}}; jdbc.queryForObject("select id from c_user_credit where member_id=? for update",Long.class,id); int cur=jdbc.queryForObject("select credit from c_user_credit where member_id=?",Integer.class,id); int next=cur+add; jdbc.update("update c_user_credit set credit=? where member_id=?",next,id); jdbc.update("insert into c_member_points_ledger(member_id,business_key,type,points,balance_after,remark) values(?,?,?,?,?,?)",id,key,"ORDER_REWARD",add,next,"完成充电订单奖励"); return new LinkedHashMap<String,Object>(){{put("points",next);put("added",add);put("already",false);}}; }
}
