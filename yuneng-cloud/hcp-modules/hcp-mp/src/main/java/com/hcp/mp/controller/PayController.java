package com.hcp.mp.controller;

import com.hcp.common.core.web.domain.AjaxResult;
import io.swagger.annotations.ApiOperation;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/pay")
public class PayController
{
    @ApiOperation("充值接口")
    @GetMapping("/xcxRecharge")
    public AjaxResult xcxRecharge(@RequestParam("amount") String amount, @RequestParam("userId") Long userId)
    {
        return AjaxResult.error("旧充值接口已停用，请登录后使用本地余额充值入口");
    }
}
