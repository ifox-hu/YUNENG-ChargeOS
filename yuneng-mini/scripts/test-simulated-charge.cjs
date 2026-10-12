// User-authorized local demo account + simulator only. Never stop pre-existing orders.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:38080/hcp-mp/';
const pileId = '202312121';
async function main() {
  const login = await fetch(base+'v1/auth/account/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'demo',password:'Demo123456!'})}).then(r=>r.json());
  assert.equal(login.code,200);
  const token=login.data.token,userId=login.data.member.memberId;
  assert.equal(userId,1008);
  async function api(route,data={}) {
    const url=new URL(route.replace(/^\//,''),base);
    for(const [k,v] of Object.entries(data)) url.searchParams.set(k,v);
    const result=await fetch(url,{headers:{token:'Bearer '+token},signal:AbortSignal.timeout(15000)}).then(r=>r.json());
    assert.equal(result.code,200,route+': '+result.msg);
    return result.data;
  }
  const before=await api('order/queryOrderList',{userId,orderStatus:1,pageNo:1,pageSize:100});
  assert(!before.records.some(o=>o.pileId===pileId),'existing active order on simulator: do not interfere');
  const pile=await api('charging/getChargingPileData',{key:pileId});
  const port=pile.list.find(p=>p.state==='N');
  assert(port,'no available simulated port');
  // Use the same saveOrder entry as the page; backend handles simulator boot/link.
  // Pre-starting the simulator here would hide failures in that page flow.
  console.log('Testing page saveOrder entry, simulated port='+port.portId);
  let created, stopped=false;
  try {
    created=await api('order/saveOrder',{portId:port.portId,amount:50,hour:1,userId});
    assert(created?.orderNumber && created.portId===port.portId);
    console.log('PASS created simulation order '+created.orderNumber);
    // Wait for the simulator heartbeat while leaving other orders alone.
    await new Promise(resolve=>setTimeout(resolve,8000));
    const current=await api('order/orderDetail',{orderNumber:created.orderNumber});
    console.log('Heartbeat: chargeStatus='+current.chargeStatus+', hour='+current.hour+', energy='+current.consumePower);
    assert.equal(String(current.chargeStatus),'9002','simulator must actually charge');
    assert.equal(Number(current.hour),1,'heartbeat must preserve booked hour');
    await api('order/endCharge',{pileId,port:port.portId,orderNumber:created.orderNumber});
    stopped=true;console.log('PASS endCharge accepted');
    for(let n=0;n<10;n++) {
      const result=await api('order/orderDetail',{orderNumber:created.orderNumber});
      if(String(result.orderState)==='3') {
        console.log('PASS settled order state=3, chargeStatus='+result.chargeStatus+', amount='+result.ordergold+', energy='+result.consumePower);
        assert.equal(String(result.chargeStatus),'9003');return;
      }
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    throw Error('end accepted but order not settled within 10 seconds');
  } finally {
    if(created?.orderNumber && !stopped) {
      // Only the order created by this test may be stopped.
      await api('order/endCharge',{pileId,port:port.portId,orderNumber:created.orderNumber});
      console.log('Stopped this test order after failure');
    }
  }
}
main().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1});
