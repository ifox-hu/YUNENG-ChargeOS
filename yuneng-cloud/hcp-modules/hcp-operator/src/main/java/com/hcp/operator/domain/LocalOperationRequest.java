package com.hcp.operator.domain;

import java.math.BigDecimal;
import lombok.Data;

/** 本地付款、退款、分账和营销操作参数。 */
@Data
public class LocalOperationRequest
{
    private Long targetTenantId;
    private String orderId;
    private String requestId;
    private Long couponId;
    private Long templateId;
    private Long memberId;
    private Long batchId;
    private BigDecimal amount;
    private BigDecimal platformRate;
    private Integer version;
    private String reason;
    private String action;
    private String name;
    private BigDecimal thresholdAmount;
    private BigDecimal discountAmount;
    private String validFrom;
    private String validTo;
    private Integer totalCount;
    private Boolean enabled;
    private String businessDay;
}
