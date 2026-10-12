package com.hcp.mp.service;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

@Service
public class PointsEventAwardService {
    private final JdbcTemplate jdbc;
    private final WalletPointsService wallet;
    public PointsEventAwardService(JdbcTemplate jdbc,WalletPointsService wallet) { this.jdbc=jdbc; this.wallet=wallet; }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void consume(String eventId) {
        List<Map<String,Object>> rows=jdbc.queryForList("select * from c_points_event where event_id=? for update",eventId);
        if(rows.isEmpty()) throw new IllegalArgumentException("Unknown points event");
        Map<String,Object> event=rows.get(0);
        if("CONSUMED".equals(event.get("status")) || "DEAD".equals(event.get("status"))) return;
        // Never accept member, amount or point values from the message body.
        Integer owned=jdbc.queryForObject("select count(*) from c_charging_order where order_id=? and user_id=? and tenant_id=?",
            Integer.class,event.get("order_id"),event.get("member_id"),event.get("tenant_id"));
        if(owned==null || owned!=1) throw new IllegalStateException("Event order identity mismatch");
        wallet.claimOrder(((Number)event.get("member_id")).longValue(),String.valueOf(event.get("order_id")));
        jdbc.update("update c_points_event set status='CONSUMED',consumed_at=now(),last_error=null,lease_token=null where event_id=?",eventId);
    }
}
