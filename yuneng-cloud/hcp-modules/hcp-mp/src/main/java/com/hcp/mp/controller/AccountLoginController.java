package com.hcp.mp.controller;

import com.hcp.common.core.domain.R;
import com.hcp.mp.service.AccountLoginService;
import com.hcp.mp.vo.UserVo;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.Map;

@RestController
@RequestMapping("/v1/auth/account")
public class AccountLoginController {
    @Resource private AccountLoginService accounts;

    @PostMapping("/login")
    public R<UserVo> login(@RequestParam String username, @RequestParam String password) {
        return accounts.login(username, password);
    }
    @PostMapping("/code")
    public R<Map<String, Object>> code(@RequestParam String mobile) {
        return accounts.sendCode(mobile);
    }
    @PostMapping("/register")
    public R<String> register(@RequestParam String username, @RequestParam String password,
                              @RequestParam String mobile, @RequestParam String code) {
        try { return accounts.register(username, password, mobile, code); }
        catch (DuplicateKeyException ex) { return R.fail("账号或手机号已注册"); }
    }
    @PostMapping("/logout")
    public R<String> logout(@RequestHeader(value="token", required=false) String token) {
        accounts.logout(token);
        return R.ok("已退出登录");
    }
}
