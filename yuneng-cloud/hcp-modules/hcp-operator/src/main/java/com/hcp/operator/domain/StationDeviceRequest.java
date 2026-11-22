package com.hcp.operator.domain;

import lombok.Data;

@Data
public class StationDeviceRequest
{
    private String pileId;
    private String name;
    private Long wxRuleId;
    private Long pileType;
    private String voltage;
    private String electricity;
    private Long maxPower;
    private Integer gunCount;
}
