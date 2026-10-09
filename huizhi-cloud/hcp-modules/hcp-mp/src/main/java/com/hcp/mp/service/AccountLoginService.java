package com.hcp.mp.service;

import com.hcp.common.core.domain.R;
import com.hcp.common.redis.service.RedisService;
import com.hcp.common.security.utils.SecurityUtils;
import com.hcp.mp.constant.MpConstant;
import com.hcp.mp.vo.UserVo;
import com.hcp.system.api.RemoteMemberService;
import com.hcp.system.api.domain.Member;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import javax.annotation.Resource;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.security.SecureRandom;

@Service
public class AccountLoginService {
    @Resource private JdbcTemplate jdbc;
    @Resource private RedisService redis;
    @Resource private RemoteMemberService members;
    @Value("${hcp.test-login.enabled:false}") private boolean localTest;

    @PostConstruct
    public void seedLocalDemo() {
        if (!localTest) return;
        List<Long> ids = jdbc.queryForList("SELECT member_id FROM c_member WHERE weixin_openid='LOCAL_DEMO_ONLY'", Long.class);
        if (!ids.isEmpty()) {
            jdbc.update("INSERT IGNORE INTO c_app_account(username,password_hash,member_id) VALUES(?,?,?)",
                    "demo", SecurityUtils.encryptPassword("Demo123456!"), ids.get(0));
        }
    }

    public R<UserVo> login(String username, String password) {
        if (username == null || password == null || password.length() > 72 || !username.matches("[A-Za-z0-9_]{3,32}")) {
            return R.fail("账号或密码错误");
        }
        String attemptsKey = "app:login-attempts:" + username;
        Integer attempts = redis.getCacheObject(attemptsKey);
        if (attempts != null && attempts >= 5) return R.fail("登录失败次数过多，请5分钟后重试");
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT password_hash,member_id FROM c_app_account WHERE username=?", username);
        if (rows.isEmpty() || !SecurityUtils.matchesPassword(password, (String) rows.get(0).get("password_hash"))) {
            redis.setCacheObject(attemptsKey, attempts == null ? 1 : attempts + 1, 5L, TimeUnit.MINUTES);
            return R.fail("账号或密码错误");
        }
        R<Member> result = members.getMemberInfo(((Number) rows.get(0).get("member_id")).longValue());
        if (result == null || result.getCode() != 200 || result.getData() == null) return R.fail("用户信息查询失败");
        redis.deleteObject(attemptsKey);
        String token = UUID.randomUUID().toString();
        redis.setCacheObject(MpConstant.USER_TOKEN + token, result.getData().getMemberId(), 2L, TimeUnit.HOURS);
        UserVo user = new UserVo();
        user.setToken(token);
        user.setMember(result.getData());
        return R.ok(user);
    }

    public R<Map<String, Object>> sendCode(String mobile) {
        if (mobile == null || !mobile.matches("1[3-9][0-9]{9}")) return R.fail("请输入正确的手机号");
        if (!localTest) return R.fail("短信服务尚未配置，暂不能注册");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM c_member WHERE mobile=?", Integer.class, mobile) > 0) return R.fail("该手机号已注册");
        String key = "app:register-code:" + mobile;
        if (redis.getCacheObject(key + ":cooldown") != null) return R.fail("请60秒后再获取验证码");
        String code = String.format("%06d", new SecureRandom().nextInt(1000000));
        redis.setCacheObject(key, code, 5L, TimeUnit.MINUTES);
        redis.setCacheObject(key + ":cooldown", true, 60L, TimeUnit.SECONDS);
        Map<String, Object> data = new HashMap<>();
        data.put("localTest", true);
        data.put("testCode", code);
        data.put("message", "本地测试验证码，未发送短信，不证明手机号归属");
        return R.ok(data);
    }

    @Transactional
    public R<String> register(String username, String password, String mobile, String code) {
        if (!localTest) return R.fail("短信服务尚未配置，暂不能注册");
        if (username == null || !username.matches("[A-Za-z0-9_]{3,32}")) return R.fail("账号须为3至32位字母、数字或下划线");
        if (password == null || !password.matches("(?=.*[A-Za-z])(?=.*[0-9])[\\x21-\\x7e]{8,32}")) return R.fail("密码须为8至32位，并包含字母和数字");
        if (mobile == null || !mobile.matches("1[3-9][0-9]{9}")) return R.fail("请输入正确的手机号");
        String key = "app:register-code:" + mobile;
        String expected = redis.getCacheObject(key);
        if (expected == null || !expected.equals(code)) return R.fail("验证码错误或已过期");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM c_app_account WHERE username=? OR mobile=?", Integer.class, username, mobile) > 0 ||
                jdbc.queryForObject("SELECT COUNT(*) FROM c_member WHERE mobile=?", Integer.class, mobile) > 0) return R.fail("账号或手机号已注册");
        String openid = "ACCOUNT_" + UUID.randomUUID().toString();
        jdbc.update("INSERT INTO c_member(weixin_openid,mobile,user_name,tenant_id,create_time) VALUES(?,?,?,?,NOW())", openid, mobile, username, 9999L);
        Long id = jdbc.queryForObject("SELECT member_id FROM c_member WHERE weixin_openid=?", Long.class, openid);
        jdbc.update("INSERT INTO c_app_account(username,mobile,password_hash,member_id) VALUES(?,?,?,?)", username, mobile, SecurityUtils.encryptPassword(password), id);
        jdbc.update("INSERT INTO c_menber_balance(member_id,amount,tenant_id,create_time) VALUES(?,0,9999,NOW())", id);
        redis.deleteObject(key);
        return R.ok("注册成功，请用账号密码登录");
    }

    public void logout(String token) {
        if (token != null) redis.deleteObject(MpConstant.USER_TOKEN + token.replaceFirst("^Bearer ", ""));
    }
}
