package com.hcp.operator.charging;

import com.hcp.system.api.domain.ChargingPile;
import com.hcp.system.api.domain.ChargingPort;
import java.math.BigDecimal;

public final class ChargeStartContext {
    public final ChargingPile pile;
    public final ChargingPort port;
    public final Long memberId;
    public final BigDecimal amount;
    public final Integer hours;

    public ChargeStartContext(ChargingPile pile, ChargingPort port, Long memberId, BigDecimal amount, Integer hours) {
        this.pile = pile;
        this.port = port;
        this.memberId = memberId;
        this.amount = amount;
        this.hours = hours;
    }
}
