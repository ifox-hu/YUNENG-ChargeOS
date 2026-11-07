const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function setup() {
  const source = fs.readFileSync(path.join(__dirname, '../yuneng-admin/src/demo/operators.js'), 'utf8');
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const db = { lists: { '/system/menu/getRouters': { data: [{ path: '/operate', children: [] }] }, '/operator/member/list': { data: [{ tenantId: 9999, memberId: 1003, userName: '演示会员' }] } } };
  module.prepareOperatorDemo(db);
  return { db, run: (url, method = 'get', body = {}, query = {}) => module.handleDemoOperators(db, url, method, body, query) };
}
test('operator demo seeds routes once, onboards without persisting passwords and rejects duplicate accounts', async () => {
  const { db, run } = await setup();
  assert.equal(db.lists['/system/menu/getRouters'].data[0].children[0].path, 'chargeRule');
  const tenant = { id: 10001, tenantName: '新运营商', userName: 'operator10001', userPhone: '13800000001', userEmail: 'operator@example.com', tenantPackage: 1, tenantTime: '2099-12-31', status: 0, initialPassword: 'Demo123456!' };
  assert.equal(run('/system/tenant/onboard', 'post', { tenant, initialPassword: 'weak' }).code, 500);
  assert.equal(run('/system/tenant/onboard', 'post', { tenant, initialPassword: tenant.initialPassword }).code, 200);
  assert.equal(JSON.stringify(db).includes('Demo123456!'), false);
  assert.equal(run('/system/tenant/onboard', 'post', { tenant, initialPassword: tenant.initialPassword }).code, 500);
  assert.equal(run('/operator/chargeRule', 'get', {}, { targetTenantId: 10001 }).data.max_charging_hours, 24);
  assert.equal(run('/operator/chargeRule', 'get', {}, { targetTenantId: 999 }).code, 500);
});
test('operator rules persist updates, reject stale versions and enforce whitelist membership', async () => {
  const { db, run } = await setup();
  assert.equal(run('/operator/chargeRule', 'put', { maxChargingHours: 6, whitelistEnabled: true, version: 0 }).code, 200);
  assert.equal(run('/operator/chargeRule', 'put', { maxChargingHours: 8, whitelistEnabled: false, version: 0 }).code, 500);
  assert.equal(run('/operator/chargeRule/member', 'post', { memberId: 999, version: 1 }).code, 500);
  assert.equal(run('/operator/chargeRule/member', 'post', { memberId: 1003, version: 1 }).code, 200);
  assert.equal(db.operatorRules[9999].members.length, 1);
  assert.equal(run('/operator/chargeRule/member', 'delete', { memberId: 1003, version: 2 }).code, 200);
  assert.equal(db.operatorRules[9999].members.length, 0);
  assert.equal(db.operatorRules[9999].max_charging_hours, 6);
});
