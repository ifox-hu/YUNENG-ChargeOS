package com.hcp.mp.controller;
import com.hcp.common.core.domain.R; import com.hcp.common.core.exception.ServiceException; import com.hcp.common.redis.service.RedisService; import com.hcp.mp.constant.MpConstant; import com.hcp.mp.service.WalletPointsService; import org.springframework.web.bind.annotation.*; import java.math.BigDecimal; import java.util.Map;
@RestController @RequestMapping
public class WalletPointsController {
 private final RedisService redis; private final WalletPointsService svc; public WalletPointsController(RedisService r,WalletPointsService s){redis=r;svc=s;}
 private long member(String token){Object id=token==null?null:redis.getCacheObject(MpConstant.USER_TOKEN+token.replaceFirst("^Bearer ",""));if(id==null)throw new ServiceException("登录已失效，请重新登录",401);return Long.parseLong(String.valueOf(id));}
 @GetMapping("/wallet/summary") public R<Map<String,Object>> wallet(@RequestHeader(value="token",required=false)String t){return R.ok(svc.wallet(member(t)));}
 @GetMapping("/wallet/ledger") public R<?> walletLedger(@RequestHeader(value="token",required=false)String t,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return R.ok(svc.walletLedger(member(t),page,size));}
 @PostMapping("/wallet/recharge") public R<Map<String,Object>> recharge(@RequestHeader(value="token",required=false)String t,@RequestBody Map<String,Object> b){Object a=b.get("amount"),q=b.get("requestId");return R.ok(svc.recharge(member(t),a==null?null:new BigDecimal(String.valueOf(a)),q==null?null:String.valueOf(q)));}
 @GetMapping("/points/summary") public R<Map<String,Object>> points(@RequestHeader(value="token",required=false)String t){return R.ok(svc.points(member(t)));}
 @GetMapping("/points/ledger") public R<?> pointsLedger(@RequestHeader(value="token",required=false)String t,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return R.ok(svc.pointsLedger(member(t),page,size));}
 @PostMapping("/points/sign") public R<Map<String,Object>> sign(@RequestHeader(value="token",required=false)String t){return R.ok(svc.sign(member(t)));}
 @GetMapping("/points/orders") public R<?> orders(@RequestHeader(value="token",required=false)String t){return R.ok(svc.eligibleOrders(member(t)));}
 @PostMapping("/points/orders/{id}/claim") public R<Map<String,Object>> claim(@RequestHeader(value="token",required=false)String t,@PathVariable String id){return R.ok(svc.claimOrder(member(t),id));}
}
