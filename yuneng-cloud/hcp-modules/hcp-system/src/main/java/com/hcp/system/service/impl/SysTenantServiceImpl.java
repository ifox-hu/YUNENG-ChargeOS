package com.hcp.system.service.impl;

import java.util.*;
import java.util.stream.Collectors;

import com.hcp.common.core.constant.CacheConstants;
import com.hcp.common.core.exception.ServiceException;
import com.hcp.common.core.utils.StringUtils;
import com.hcp.common.core.web.domain.AjaxResult;
import com.hcp.common.mybatisplus.util.TenantUtils;
import com.hcp.common.redis.service.RedisService;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.system.api.domain.*;
import com.hcp.system.api.model.LoginUser;
import com.hcp.system.domain.*;
import com.hcp.system.mapper.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.hcp.system.service.ISysTenantService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hcp.common.core.text.Convert;
import com.hcp.common.core.utils.ServletUtils;
import com.hcp.common.mybatisplus.constant.MybatisPageConstants;
import org.springframework.transaction.annotation.Transactional;


/**
 * 租户管理Service业务层处理
 *
 * @author vctgo
 * @date 2022-04-11
 */
@Slf4j
@Service
public class SysTenantServiceImpl implements ISysTenantService
{
    @Autowired
    private SysTenantMapper sysTenantMapper;

    @Autowired
    private SysTenantPackageMapper sysTenantPackageMapper;

    @Autowired
    private SysDeptMapper deptMapper;

    @Autowired
    private SysPostMapper sysPostMapper;

    @Autowired
    private SysRoleMapper sysRoleMapper;

    @Autowired
    private SysRoleMenuMapper sysRoleMenuMapper;

    @Autowired
    private SysRoleDeptMapper sysRoleDeptMapper;

    @Autowired
    private SysUserMapper userMapper;

    @Autowired
    private SysUserRoleMapper userRoleMapper;

    @Autowired
    private SysUserPostMapper userPostMapper;

    @Autowired
    private RedisService redisService;

    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired private com.hcp.common.mybatisplus.tenant.TenantLifecycle lifecycle;

    private void requirePlatformAdmin() {
        if (!SecurityUtils.isAdmin(SecurityUtils.getUserId())) throw new ServiceException("仅平台管理员可管理运营商");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AjaxResult onboard(SysTenant tenant, String initialPassword) {
        requirePlatformAdmin();
        if (initialPassword == null || !initialPassword.matches("(?=.*[A-Za-z])(?=.*[0-9])[\\x21-\\x7e]{8,20}")) {
            throw new ServiceException("初始密码须为8至20位字母、数字组合");
        }
        return initializeTenant(tenant, initialPassword);
    }

    private void validateTenant(SysTenant tenant) {
        if (tenant == null || tenant.getId() == null || tenant.getId() <= 0 || tenant.getId() == 9999L
                || StringUtils.isBlank(tenant.getTenantName()) || tenant.getTenantName().length() > 20
                || tenant.getUserName() == null || !tenant.getUserName().matches("[A-Za-z0-9_]{3,20}")
                || tenant.getTenantTime() == null || !tenant.getTenantTime().after(new Date())) {
            throw new ServiceException("运营商编码、名称、管理员账号或到期日无效");
        }
        validatePackage(tenant.getTenantPackage());
        if (sysTenantMapper.selectById(tenant.getId()) != null || userMapper.checkUserNameUnique(tenant.getUserName()) != null)
            throw new ServiceException("运营商编码或管理员账号已存在");
    }

    private void validatePackage(Long id) {
        SysTenantPackage pack = id == null ? null : sysTenantPackageMapper.selectById(id);
        if (pack == null || !Integer.valueOf(0).equals(pack.getStatus()) || !"0".equals(pack.getDelFlag())
                || StringUtils.isBlank(pack.getMenuIds())) throw new ServiceException("套餐不存在、停用或未配置菜单");
        for (String raw : pack.getMenuIds().split(",")) {
            if (!raw.matches("[0-9]+")) throw new ServiceException("套餐菜单无效");
            List<Map<String,Object>> menus = jdbc.queryForList("SELECT perms,path,component FROM sys_menu WHERE menu_id=?",Long.valueOf(raw));
            if (menus.isEmpty()) throw new ServiceException("套餐包含无效菜单");
            Map<String,Object> menu = menus.get(0);
            String perms = String.valueOf(menu.get("perms"));
            String path = String.valueOf(menu.get("path")).toLowerCase(Locale.ROOT);
            String component = String.valueOf(menu.get("component")).toLowerCase(Locale.ROOT);
            if (perms.startsWith("system:tenant") || perms.contains("*" ) || path.contains("tenant") || component.contains("tenant"))
                throw new ServiceException("套餐不得包含平台租户管理权限");
        }
    }

    private AjaxResult initializeTenant(SysTenant tenant, String password) {
        validateTenant(tenant);
        tenant.setStatus(0); tenant.setDelFlag("0");
        try {
            sysTenantMapper.insert(tenant);
            TenantUtils.execute(tenant.getId(), () -> {
                Long deptId = createDept(tenant);
                Long postId = createPost(tenant.getUserName());
                Long roleId = createRole(tenant);
                createUser(tenant,deptId,postId,roleId,password);
                lifecycle.initializeChargingRule(tenant.getId());
            });
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            throw new ServiceException("运营商编码或管理员账号已存在");
        }
        return AjaxResult.success("运营商开户成功，请通过安全渠道交付账号并提醒修改密码");
    }


    /**
     * 查询租户管理
     *
     * @param id 租户管理主键
     * @return 租户管理
     */
    @Override
    public SysTenant selectSysTenantById(Long id)
    {
        return sysTenantMapper.selectById(id);
    }

    /**
     * 查询租户管理列表-分页
     *
     * @param sysTenant 租户管理
     * @return 租户管理
     */
    @Override
    public IPage<SysTenant> selectSysTenantPage(SysTenant sysTenant)
    {
        Page mpPage =new Page(Convert.toLong(ServletUtils.getParameterToInt(MybatisPageConstants.PAGE_NUM),1L)
                ,Convert.toLong(ServletUtils.getParameterToInt(MybatisPageConstants.PAGE_SIZE),10L));
        return sysTenantMapper.selectSysTenantList(mpPage,sysTenant);
    }
    /**
     * 查询租户管理列表
     *
     * @param sysTenant 租户管理
     * @return 租户管理
     */
    @Override
    public List<SysTenant> selectSysTenantList(SysTenant sysTenant) {return sysTenantMapper.selectSysTenantList(sysTenant);}

    /**
     * 新增租户管理
     *
     * @param sysTenant 租户管理
     * @return 结果
     */

    @Override
    @Transactional(rollbackFor = Exception.class)

    public AjaxResult insertSysTenant(SysTenant sysTenant)
    {
        requirePlatformAdmin();
        // Legacy random-password delivery is retired; explicit delivery avoids external side effects.
        throw new ServiceException("请使用运营商开户入口设置初始密码");
    }

    private void createUser(SysTenant sysTenant,Long deptId,Long postid,Long roleid, String initialPassword) {
        SysUser user = new SysUser();
        user.setDeptId(deptId).setUserName(sysTenant.getUserName()).setNickName(sysTenant.getTenantName())
                .setUserType("00")//用户类型 00 表示各管理员账号，不允许租户修改删除 其他账号为10
                .setEmail(sysTenant.getUserEmail()).setPhonenumber(sysTenant.getUserPhone()).setRemark("租户管理员");
        String password = SecurityUtils.encryptPassword(initialPassword);
        user.setPassword(password);
        userMapper.insert(user);
        userPostMapper.insert(new SysUserPost().setUserId(user.getUserId()).setPostId(postid));
        userRoleMapper.insert(new SysUserRole().setRoleId(roleid).setUserId(user.getUserId()));
    }

    private Long createRole(SysTenant sysTenant) {
        // 创建角色
        SysRole role = new SysRole();
        role.setRoleName(sysTenant.getTenantName()+"管理员").setRoleKey("admin")
                .setRoleSort("1").setDataScope("1").setMenuCheckStrictly(true).setDeptCheckStrictly(true);
        role.setCreateBy(sysTenant.getUserName());
        role.setRemark("租户管理员");
        role.setAdminRole(true);
        sysRoleMapper.insert(role);
        //根据租户套餐ids查出套餐编码塞入角色-菜单表
        createRoleMenu(sysTenant,role);
        return role.getRoleId();
    }

    //目前为单套餐,跟租户绑定,解耦防止套餐变动影响多个租户
    private void createRoleMenu(SysTenant sysTenant,SysRole role)
    {
        SysTenantPackage sysTenantPackage = sysTenantPackageMapper.selectById(sysTenant.getTenantPackage());
        List<String> subMeuns = Arrays.asList(sysTenantPackage.getMenuIds().split(","));

        List<SysRoleMenu> roleMenuList = subMeuns.stream().map(menuid -> {
            SysRoleMenu entity = new SysRoleMenu();
            entity.setRoleId(role.getRoleId());
            entity.setMenuId(Convert.toLong(menuid));
            return entity;
        }).collect(Collectors.toList());
        sysRoleMenuMapper.batchRoleMenu(roleMenuList);
    }

    private Long createPost(String username) {
        SysPost post = new SysPost();
        post.setPostCode("ceo").setPostName("董事长").setPostSort("1");
        post.setCreateBy(username);
        sysPostMapper.insert(post);
        return post.getPostId();
    }

    private Long createDept(SysTenant sysTenant) {
        // 创建部门
        SysDept dept = new SysDept();
        dept.setParentId(0L).setAncestors("0").setDeptName(sysTenant.getTenantName()).setOrderNum(0)
                .setLeader(sysTenant.getUserName()).setPhone(sysTenant.getUserPhone()).setEmail(sysTenant.getUserEmail());
        deptMapper.insert(dept);
        return dept.getDeptId();
    }


    /**
     * 修改租户管理
     *
     * @param sysTenant 租户管理
     * @return 结果
     */
    @Override
    public int updateSysTenant(SysTenant sysTenant)
    {
        requirePlatformAdmin();
        if (sysTenant.getTenantPackage() != null) validatePackage(sysTenant.getTenantPackage());
        //判断最新的租户套餐是否改变 重新授权 租户二级管理员账号需重新分配三级账号权限
        SysTenant t_sysTenant = sysTenantMapper.selectById(sysTenant.getId());
        if(sysTenant.getTenantPackage() != null && !sysTenant.getTenantPackage().equals(t_sysTenant.getTenantPackage()))
        {
            List<SysRole> roleList = sysRoleMapper.queryAdminRole(sysTenant.getId());
            SysRole t_role = roleList.get(0);//正常逻辑下每个租户只有一个二级管理员账号
            if(t_role != null)
            {
                //删除原租户下所有的角色-菜单信息
                sysRoleMenuMapper.deleteRoleMenuByTenantId(sysTenant.getId());
                //新增默认角色-菜单信息
                TenantUtils.execute(sysTenant.getId(), () -> {
                    createRoleMenu(sysTenant,t_role);
                });
                // TODO  此处需要优化,如果当前同时在线人数较多,会出现卡顿
                //原登租户录账号退出重登 租户二级管理员账号需重新分配三级账号权限
                Collection<String> keys = redisService.keys(CacheConstants.LOGIN_TOKEN_KEY + "*");
                for (String key : keys)
                {
                    LoginUser onlineUser = redisService.getCacheObject(key);
                    if(onlineUser.getSysUser().getTenantId() != null && onlineUser.getSysUser().getTenantId().equals(sysTenant.getId()))
                    {
                        redisService.deleteObject(key);
                    }
                }
            }
        }
        return sysTenantMapper.updateById(sysTenant);
    }

    /**
     * 批量删除租户管理
     *
     * @param ids 需要删除的租户管理主键
     * @return 结果
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteSysTenantByIds(Long[] ids)
    {
        requirePlatformAdmin();
        //优化删除逻辑
        //1.先删租户
        int tenantres = sysTenantMapper.deleteSysTenantByIds(ids);
        if(tenantres>0){
            //下面才会进行子模块数据的删除
            //部门模块
            deptMapper.deleteDeptByTenantId(ids);
            //职位模块
            sysPostMapper.deletePostByTenantId(ids);
            //权限
            sysRoleMapper.deleteRoleByTenantId(ids);
            sysRoleMenuMapper.deleteRoleMenuByTenantIds(ids);
            sysRoleDeptMapper.deleteRoleDeptByTenantId(ids);
            //账号
            userMapper.deleteUserByTenantId(ids);
            userRoleMapper.deleteUserRoleByTenantId(ids);
            userPostMapper.deleteUserPostByTenantId(ids);
            return 1;
        }else {
            throw new ServiceException("当前租户已被删除不存在！");
        }
    }

    /**
     * 删除租户管理信息
     *
     * @param id 租户管理主键
     * @return 结果
     */
    @Override
    public int deleteSysTenantById(Long id)
    {
        requirePlatformAdmin();
        return sysTenantMapper.deleteById(id);
    }
}
