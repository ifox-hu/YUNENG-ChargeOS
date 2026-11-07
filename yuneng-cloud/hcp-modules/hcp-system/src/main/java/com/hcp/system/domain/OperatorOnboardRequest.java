package com.hcp.system.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Not a persistent tenant field; never include the request in operation logs. */
public class OperatorOnboardRequest {
    private SysTenant tenant;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String initialPassword;
    public SysTenant getTenant() { return tenant; }
    public void setTenant(SysTenant tenant) { this.tenant = tenant; }
    public String getInitialPassword() { return initialPassword; }
    public void setInitialPassword(String password) { this.initialPassword = password; }
}
