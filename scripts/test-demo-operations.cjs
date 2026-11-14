const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function setup() {
  const source = fs.readFileSync(path.join(__dirname, '../yuneng-admin/src/demo/operations.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '../yuneng-admin/src/demo/fixtures.json'), 'utf8'));
  const db = { lists: fixtures, faults: [] };
  mod.prepareOperationsDemo(db);
  const run = (resource, body, query = {}) => mod.handleOperations(db, '/operator/operations/' + resource, body ? 'post' : 'get', body || {}, query);
  const member = db.lists['/operator/member/list'].data[0].memberId;
  return { db, run, member };
}
test('payment replay, request collisions, coupon restore and cumulative split reversals conserve money', async () => {
  const { db, run, member } = await setup();
  assert.equal(run('coupon', { name: '满20减5', thresholdAmount: 20, discountAmount: 5, totalCount: 1, validFrom: '2020-01-01 00:00:00', validTo: '2099-01-01 00:00:00' }).code, 200);
  const templateId = db.operations.templates[0].id;
  const couponId = run('coupon/issue', { templateId, memberId: member, requestId: 'issue' }).data.id;
  const request = { orderId: 'LOCAL_DEMO_0', requestId: 'pay', couponId };
  assert.equal(run('pay', request).code, 200); assert.equal(run('pay', request).code, 200);
  assert.equal(run('pay', { ...request, couponId: null }).code, 500);
  assert.equal(run('pay', { orderId: 'LOCAL_DEMO_1', requestId: 'pay' }).code, 500);
  assert.equal(db.operations.accounts[member], 98500);
  assert.equal(run('split', { orderId: request.orderId }).code, 200);
  for (const [i, amount] of [0.01, 4.99, 10].entries()) {
    const refund = { orderId: request.orderId, requestId: 'refund' + i, amount, reason: 'verify' };
    assert.equal(run('refund', refund).code, 200); assert.equal(run('refund', refund).code, 200);
  }
  assert.equal(db.operations.accounts[member], 100000);
  assert.equal(db.operations.coupons[0].status, 'UNUSED');
  assert.equal(Math.round(db.operations.splits.reduce((sum, row) => sum + row.platform_amount + row.station_amount, 0) * 100), 0);
  assert.equal(run('refund', { orderId: request.orderId, requestId: 'over', amount: 1, reason: 'verify' }).code, 500);
  const day = new Date().toLocaleDateString('sv-SE');
  assert.equal(run('reconcile', { businessDay: day }).data.difference_count, 0);
  db.operations.ledgers[0].amount += 1;
  assert.equal(run('reconcile', { businessDay: day }).data.difference_count, 1);
});
test('zero payment void restores coupon without credit; history and cross-tenant operations reject', async () => {
  const { db, run, member } = await setup();
  run('coupon', { name: '全抵', thresholdAmount: 20, discountAmount: 20, totalCount: 1, validFrom: '2020-01-01 00:00:00', validTo: '2099-01-01 00:00:00' });
  const couponId = run('coupon/issue', { templateId: db.operations.templates[0].id, memberId: member, requestId: 'issue' }).data.id;
  assert.equal(run('pay', { orderId: 'LOCAL_DEMO_0', requestId: 'pay', couponId }).data.paid_amount, 0);
  assert.equal(run('refund', { orderId: 'LOCAL_DEMO_1', requestId: 'history', amount: 1, reason: 'verify' }).code, 500);
  assert.equal(run('void', { orderId: 'LOCAL_DEMO_0', reason: '撤销' }).code, 200);
  assert.equal(db.operations.coupons[0].status, 'UNUSED'); assert.equal(db.operations.accounts[member], 100000);
  assert.equal(run('pay', { targetTenantId: 12345, orderId: 'LOCAL_DEMO_1', requestId: 'foreign' }).code, 500);
  assert.equal(run('overview', null, { targetTenantId: 12345 }).data.summary.orders, 0);
});
test('uncertain order cannot be cancelled or hidden by a note', async () => {
  const { run } = await setup();
  assert.equal(run('exception/action', { orderId: 'LOCAL_DEMO_13', action: 'CANCEL', reason: 'verify' }).code, 500);
  assert.equal(run('exception/action', { orderId: 'LOCAL_DEMO_13', action: 'NOTE', reason: 'verify' }).code, 200);
  assert(run('orders', null, { exceptions: 'true', size: 100 }).data.records.some(row => row.order_id === 'LOCAL_DEMO_13'));
});
