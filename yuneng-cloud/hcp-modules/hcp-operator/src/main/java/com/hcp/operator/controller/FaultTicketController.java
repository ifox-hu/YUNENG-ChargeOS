package com.hcp.operator.controller;

import com.hcp.common.core.domain.R;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.security.annotation.InnerAuth;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.common.security.auth.AuthUtil;
import com.hcp.operator.service.FaultTicketService;
import com.hcp.system.api.domain.FaultRequest;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/fault")
public class FaultTicketController {
    @Resource private FaultTicketService tickets;
    @RequiresPermissions("operator:fault:list")
    @GetMapping("/list")
    public R<Map<String,Object>> list(@RequestParam(required=false) String status,
        @RequestParam(required=false) String faultType, @RequestParam(required=false) String pileId,
        @RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="10") int pageSize) {
        return R.ok(tickets.list(tickets.operator(),null,status,faultType,pileId,pageNum,pageSize));
    }
    @RequiresPermissions("operator:fault:list")
    @GetMapping("/stats")
    public R<Map<String,Object>> stats() { return R.ok(tickets.stats(tickets.operator())); }
    @RequiresPermissions("operator:fault:list")
    @GetMapping("/{id}")
    public R<Map<String,Object>> detail(@PathVariable Long id) { return R.ok(tickets.detail(id,tickets.operator(),null)); }
    @RequiresPermissions("operator:fault:assign")
    @GetMapping("/{id}/assignees")
    public R<List<Map<String,Object>>> assignees(@PathVariable Long id) {
        return R.ok(tickets.assignees(tickets.operator(),id));
    }
    @RequiresPermissions("operator:fault:add")
    @PostMapping("/simulate-alarm")
    public R<Map<String,Object>> alarm(@RequestBody FaultRequest request) {
        return R.ok(tickets.create(request,null,tickets.operator()));
    }
    @PostMapping("/{id}/action")
    public R<Map<String,Object>> action(@PathVariable Long id,@RequestBody FaultRequest request) {
        String action=request.getAction();
        if ("ASSIGN".equals(action)) AuthUtil.checkPermi("operator:fault:assign");
        else if ("CONFIRM".equals(action)) AuthUtil.checkPermi("operator:fault:close");
        else if ("START".equals(action)||"RESOLVE".equals(action)) AuthUtil.checkPermi("operator:fault:handle");
        else throw new ServiceException("操作类型不合法");
        return R.ok(tickets.action(id,request,tickets.operator(),null));
    }
    @InnerAuth
    @PostMapping("/internal/report")
    public R<Map<String,Object>> report(@RequestBody FaultRequest request,@RequestParam Long memberId) {
        return R.ok(tickets.create(request,memberId,null));
    }
    @InnerAuth
    @GetMapping("/internal/mine")
    public R<Map<String,Object>> mine(@RequestParam Long memberId,@RequestParam int pageNum,@RequestParam int pageSize) {
        return R.ok(tickets.list(null,memberId,null,null,null,pageNum,pageSize));
    }
    @InnerAuth
    @GetMapping("/internal/{id}")
    public R<Map<String,Object>> mineDetail(@PathVariable Long id,@RequestParam Long memberId) {
        return R.ok(tickets.detail(id,null,memberId));
    }
    @InnerAuth
    @PostMapping("/internal/{id}/confirm")
    public R<Map<String,Object>> confirm(@PathVariable Long id,@RequestParam Long memberId) {
        FaultRequest request=new FaultRequest(); request.setAction("CONFIRM"); request.setNote("用户确认故障已解决");
        return R.ok(tickets.action(id,request,null,memberId));
    }
}
