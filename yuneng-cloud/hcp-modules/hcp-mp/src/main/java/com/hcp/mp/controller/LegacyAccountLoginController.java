package com.hcp.mp.controller;

import com.hcp.common.core.domain.R;
import com.hcp.mp.service.AccountLoginService;
import com.hcp.mp.vo.UserVo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;

/** Keep previously compiled local clients working through the same account validation. */
@RestController
@RequestMapping("/v1/auth")
public class LegacyAccountLoginController {
    @Resource private AccountLoginService accounts;

    @PostMapping("/testLogin")
    public R<UserVo> login(@RequestParam String username, @RequestParam String password) {
        return accounts.login(username, password);
    }
}
