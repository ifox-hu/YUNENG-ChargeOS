const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:38080/hcp-mp';
async function main() {
  const login = await (await fetch(base + '/v1/auth/account/login', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'username=demo&password=Demo123456!'
  })).json();
  assert.equal(login.code, 200);
  const headers = { token: 'Bearer ' + login.data.token };
  const member = login.data.member.memberId;
  const list = async (userId, auth = headers) => (await fetch(base +
    '/order/queryOrderList?' + new URLSearchParams({ userId, pageNo: 1, pageSize: 5 }), { headers: auth })).json();
  const own = await list(member), spoofed = await list('1');
  assert.equal(own.code, 200); assert.equal(spoofed.code, 200);
  assert.deepEqual(spoofed.data.records.map(o => o.orderId), own.data.records.map(o => o.orderId));
  assert.ok(spoofed.data.records.every(o => String(o.userId) === String(member)));
  assert.notEqual((await list(member, {})).code, 200);
  const invalid = await (await fetch(base + '/order/saveOrder?' +
    new URLSearchParams({ userId: '1', portId: '1', amount: '-1', hour: '25' }), { headers })).json();
  assert.notEqual(invalid.code, 200);
  console.log('PASS login required; client user ID cannot select another member; invalid start parameters rejected');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
