package com.hcp.operator.charging;

import com.hcp.common.core.exception.ServiceException;
import com.hcp.operator.mapper.MemberMapper;
import com.hcp.system.api.domain.Member;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class ChargeMemberValidator implements ChargeStartValidator {
    private final MemberMapper members;
    public ChargeMemberValidator(MemberMapper members) { this.members = members; }
    public int order() { return 20; }

    public void validate(ChargeStartContext context) {
        Member member = members.selectByMemberId(context.memberId);
        if (member == null) throw new ServiceException("充电用户不存在");
        if (context.port == null || context.port.getTenantId() == null
                || !Objects.equals(member.getTenantId(), context.port.getTenantId())) {
            throw new ServiceException("无权使用该租户的充电设备");
        }
    }
}
