package com.hcp.operator.controller;

import com.hcp.common.core.web.domain.AjaxResult;
import com.hcp.common.security.annotation.RequiresPermissions;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.log.annotation.Log;
import com.hcp.common.log.enums.BusinessType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

/** Global reliability operations are restricted to the platform administrator. */
@RestController
@RequestMapping("/points/events")
public class PointsEventController
{
    private final JdbcTemplate jdbc;

    public PointsEventController(JdbcTemplate jdbc)
    {
        this.jdbc = jdbc;
    }

    private void admin()
    {
        if (!SecurityUtils.isAdmin(SecurityUtils.getUserId()))
            throw new ServiceException("仅平台管理员可操作积分事件");
    }

    @GetMapping
    @RequiresPermissions("operator:order:list")
    public AjaxResult list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size,
                           @RequestParam(required = false) String status,
                           @RequestParam(required = false) Long targetTenantId)
    {
        admin();
        int limit = Math.max(1, Math.min(50, size)), offset = (Math.max(1, Math.min(10000, page)) - 1) * limit;
        String where = " WHERE 1=1";
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (targetTenantId != null) { where += " AND tenant_id=?"; args.add(targetTenantId); }
        String countWhere = where;
        Object[] countArgs = args.toArray();
        if (status != null) { where += " AND status=?"; args.add(status); }
        args.add(limit); args.add(offset);
        AjaxResult result = AjaxResult.success(jdbc.queryForList(
            "select * from c_points_event" + where + " order by created_at desc limit ? offset ?", args.toArray()));
        result.put("counts", jdbc.queryForList("select status,count(*) as total from c_points_event" + countWhere + " group by status", countArgs));
        return result;
    }

    @PostMapping("/{id}/retry")
    @RequiresPermissions("operator:order:edit")
    @Log(title = "积分事件人工重试", businessType = BusinessType.UPDATE)
    public AjaxResult retry(@PathVariable String id)
    {
        admin();
        int changed =
            jdbc.update("update c_points_event set status='PENDING',publish_attempts=0,consume_failures=0,"
                            + "last_error=null,lease_token=null,next_retry_at=now() where event_id=? and status='DEAD'",
                        id);
        return changed == 1 ? AjaxResult.success("已加入补偿队列") : AjaxResult.error("仅失败终止事件可重新投递");
    }
}
