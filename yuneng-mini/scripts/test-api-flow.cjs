const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:38080/hcp-mp/';
async function run() {
  async function api(route, data = {}, token = '', post = false) {
    const url = new URL(route.replace(/^\//, ''), base);
    if (!post) Object.entries(data).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, { method: post ? 'POST' : 'GET', headers: { token: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: post ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    assert.equal(result.code, 200, route + ': ' + result.msg);
    return result.data;
  }
  const response = await fetch(base + 'v1/auth/account/login', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'demo',password:'Demo123456!'}),signal:AbortSignal.timeout(15000)});
  const auth = await response.json(); assert.equal(auth.code,200);
  const token = auth.data.token, userId = auth.data.member.memberId;
  console.log('PASS account login');
  for (const route of ['me/getUserCredit','me/getMemberBalanceByUserId','me/queryMonthTotalByUserId']) {
    const result = await api(route,{userId},token);
    console.log('PASS ' + route + ' fields=' + Object.keys(result || {}).join(','));
  }
  const stations = await api('charging/getPlotInfoPage',{pageNo:1,pageSize:5,deviceType:4,lat:39.9045035,lng:116.408788,sortType:1,distance:100000000},token,true);
  console.log('PASS stations count=' + stations.records.length);
  if(stations.records.length) {
    const s = stations.records[0];
    const detail = await api('charging/plotDetail',{plotId:s.stationId,deviceType:s.deviceType,distance:s.distance},token);
    console.log('PASS station detail fields=' + Object.keys(detail).join(','));
  }
  const pile = await api('charging/getChargingPileData',{key:'202312121'},token);
  console.log('PASS simulated pile ports=' + JSON.stringify(pile.list.map(p=>({portId:p.portId,deviceId:p.deviceId,state:p.state}))));
  for(const orderStatus of ['',1,3]) {
    const orders = await api('order/queryOrderList',{userId,pageNo:1,pageSize:5,orderStatus},token);
    console.log('PASS orders status=' + orderStatus + ' count=' + orders.records.length);
    if(orders.records.length) {
      const detail = await api('order/orderDetail',{orderNumber:orders.records[0].orderNumber},token);
      assert(detail && detail.orderNumber === orders.records[0].orderNumber, 'order detail must contain the requested order');
      console.log('PASS order detail');
    }
  }
  for(const url of [
    base+'order/orderDetail?orderNumber=45164023035571475306413263973320',
    'http://127.0.0.1:39206/order/internal/detail?orderNumber=45164023035571475306413263973320'
  ]) {
    const denied=await fetch(url,{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
    assert.notEqual(denied.code,200,'unauthenticated order details must be rejected');
  }
  console.log('PASS order detail rejects missing session and missing internal-service header');
}
run().catch(e=>{console.error('FAIL ' + e.message);process.exitCode=1});
