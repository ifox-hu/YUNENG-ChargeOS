package com.hcp.operator.charging;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ChargeStartValidationChain {
    private final List<ChargeStartValidator> validators;

    public ChargeStartValidationChain(List<ChargeStartValidator> validators) {
        this.validators = new ArrayList<>(validators);
        this.validators.sort(Comparator.comparingInt(ChargeStartValidator::order));
    }

    public void validate(ChargeStartContext context) {
        for (ChargeStartValidator validator : validators) validator.validate(context);
    }
}
