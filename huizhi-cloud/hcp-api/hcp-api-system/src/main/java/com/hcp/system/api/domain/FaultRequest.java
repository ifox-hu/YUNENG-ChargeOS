package com.hcp.system.api.domain;

import lombok.Data;

/** Identity and source are always derived on the server, never accepted from this DTO. */
@Data
public class FaultRequest {
    private String pileId;
    private String faultType;
    private String priority;
    private String description;
    private Long assigneeId;
    private String action;
    private String note;
}

