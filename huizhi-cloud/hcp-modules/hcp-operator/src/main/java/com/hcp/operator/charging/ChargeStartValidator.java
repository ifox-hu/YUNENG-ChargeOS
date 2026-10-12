package com.hcp.operator.charging;

public interface ChargeStartValidator {
    int order();
    void validate(ChargeStartContext context);
}
