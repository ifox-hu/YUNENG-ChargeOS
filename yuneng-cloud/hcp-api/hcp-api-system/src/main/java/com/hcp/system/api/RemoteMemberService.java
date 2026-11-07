package com.hcp.system.api;

import com.hcp.common.core.constant.ServiceNameConstants;
import com.hcp.common.core.domain.R;
import com.hcp.system.api.domain.Member;
import com.hcp.system.api.factory.RemoteUserFallbackFactory;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * 用户服务
 *
 * @author vctgo
 */
@FeignClient(contextId = "remoteMemberService", value = ServiceNameConstants.OPERATOR_SERVICE, fallbackFactory = RemoteUserFallbackFactory.class)
public interface RemoteMemberService
{
    /**
     * 通过id获取小程序会员信息
     *
     * @param id 用户名
     * @return 结果
     */
    @GetMapping(value="/member/info/{id}",headers="from-source=inner")
    R<Member> getMemberInfo(@PathVariable("id") Long id);

    @GetMapping(value="/member/memberInfo/{openId}",headers="from-source=inner")
    R<Member> getMemberInfoByOpenId(@PathVariable("openId") String openId);

    /**
     * 注册用户信息
     * @return 结果
     */
    @PostMapping(value="/member/info/register",headers="from-source=inner")
    R<Member> addMemberInfo(@RequestBody Member member);


    @PostMapping(value="/member/info/update",headers="from-source=inner")
    R<Integer> updateMemberById(@RequestBody Member member);
}
