const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
(async () => {
  const period = url(fs.readFileSync('yuneng-admin/src/views/operations/period.js', 'utf8'));
  const source = fs.readFileSync('yuneng-admin/src/demo/overview.js', 'utf8').replace("'../views/operations/period'", JSON.stringify(period));
  const { demoOverview } = await import(url(source));
  const orders = ['3', '4', '5', '2', '1', '6', '7', 'unexpected'].map((orderState, i) => ({ orderId: String(i), tenantId: 9, pileId: 'a', orderState, ordergold: [10, 8, 20, 0, 0, 5, 7, 3][i], refundAmount: orderState === '4' ? 2 : 0, consumePower: i + 1, createTime: '2026-11-0' + (i % 2 + 1) + ' ' + String(i).padStart(2, '0') + ':00:00' }));
  orders.push({ tenantId: 9, pileId: 'a', orderState: '3', ordergold: 20, consumePower: 4, createTime: '2026-10-31 23:59:59' }, { tenantId: 9, pileId: 'a', orderState: '3', ordergold: 999, consumePower: 999, createTime: '2026-10-29 23:59:59' }, { tenantId: 9, pileId: 'a', orderState: '3', ordergold: 999, consumePower: 999, createTime: '2026-11-03 00:00:00' }, { tenantId: 10, pileId: 'foreign', orderState: '3', ordergold: 999, consumePower: 999, createTime: '2026-11-01 00:00:00' });
  const db = { lists: {
    '/system/tenant/list': { data: [{ id: 9, tenantName: '测试运营商' }, { id: 10, tenantName: '外部运营商' }] },
    '/operator/station/list': { data: [{ stationId: 1, tenantId: 9, stationName: '测试站点' }, { stationId: 2, tenantId: 10, stationName: '外部站点' }, { stationId: 3, tenantId: 9, stationName: '空站点' }] },
    '/operator/pile/list': { data: [{ pileId: 'a', stationId: 1, tenantId: 9, runningStatus: 0 }, { pileId: 'b', stationId: 1, tenantId: 9, runningStatus: 1, offlineTime: '2026-10-30 00:00:00' }, { pileId: 'c', stationId: 1, tenantId: 9, runningStatus: 1 }, { pileId: 'foreign', stationId: 2, tenantId: 10, runningStatus: 1 }] },
    '/operator/order/list': { data: orders }
  }, faults: [{ id: 1, pileId: 'a', tenantId: 9, status: 'NEW', createdAt: '2026-10-30 00:00:00' }, { id: 2, pileId: 'a', tenantId: 9, status: 'RESOLVED', createdAt: '2026-11-01 00:00:00' }, { id: 3, pileId: 'a', tenantId: 9, status: 'CLOSED' }, { id: 4, pileId: 'foreign', tenantId: 10, status: 'NEW' }] };
  const query = { tenantId: 9, stationId: 1, startDate: '2026-11-01', endDate: '2026-11-02' };
  const data = demoOverview(db, query, { root: true }, new Date('2026-11-03T00:00:00+08:00'));
  assert.equal(data.hourly.length, 24, 'new hourly aggregate must contain all 24 hours');
  assert.equal(data.hourly.reduce((s, r) => s + r.count, 0), 8);
  assert.equal(data.hourly.reduce((s, r) => s + r.power, 0), 36);
  assert.equal(data.orderQuality.states.reduce((s, r) => s + r.count, 0), 8, 'include unknown states explicitly');
  assert.equal(data.orderQuality.states.find(s => s.state === '4').count, 1);
  assert.equal(data.orderQuality.refundCount, 1); assert.equal(data.orderQuality.refundAmount, 2);
  assert.equal(data.orderQuality.cancelledCount, 1);
  assert.deepEqual(data.comparison.period, { startDate: '2026-10-30', endDate: '2026-10-31' });
  assert.equal(data.comparison.summary.realSales, 20); assert.equal(data.comparison.summary.chargeTimes, 1); assert.equal(data.comparison.summary.consumePower, 4);
  assert.equal(data.summary.realSales, 48);
  assert.equal(data.stationStats[0].activeDeviceCount, 1);
  assert.equal(data.actionSummary.offline24Count, 1); assert.equal(data.actionSummary.offlineUnknownCount, 1);
  assert.equal(data.faultSummary.pending, 1); assert.equal(data.faultSummary.resolved, 1);
  assert.ok(data.offlineDevices.some(p => p.pileId === 'b' && p.offlineMinutes >= 24 * 60));
  assert.equal(data.offlineDevices.find(p => p.pileId === 'c').offlineMinutes, null);
  const empty = demoOverview(db, { ...query, stationId: 3 });
  assert.equal(empty.hourly.reduce((s, r) => s + r.count, 0), 0); assert.equal(empty.stationStats[0].deviceCount, 0);
  assert.equal(empty.orderQuality.states.reduce((s, r) => s + r.count, 0), 0);
  assert.throws(() => demoOverview(db, { ...query, tenantId: 10 }, { root: false, tenantId: 9 }), /无权/);
  assert.throws(() => demoOverview(db, { ...query, stationId: 2 }), /站点/);
  assert.equal(demoOverview(db, { tenantId: 9 }).comparison.available, false, 'do not compare an unbounded all-time summary');
  const { periodComparison, businessMetrics, durationText } = await import(url(fs.readFileSync('yuneng-admin/src/views/operations/insights.js', 'utf8')));
  assert.match(periodComparison(30, 20).text, /50.0%/); assert.equal(periodComparison(30, 20).direction, 'up');
  assert.equal(periodComparison(10, 20).direction, 'down'); assert.equal(periodComparison(0, 0).direction, 'neutral');
  assert.match(periodComparison(10, 0).text, /基数/); assert.match(periodComparison(null, 0).text, /暂无/);
  assert.equal(businessMetrics({ revenue: 48, deviceCount: 3, activeDeviceCount: 1 }).revenuePerDevice, 16);
  assert.ok(Math.abs(businessMetrics({ revenue: 48, deviceCount: 3, activeDeviceCount: 1 }).activeDeviceRate - 100 / 3) < 1e-10);
  assert.equal(businessMetrics({ revenue: 0, deviceCount: 0, activeDeviceCount: 0 }).activeDeviceRate, null);
  assert.equal(durationText(null), '时间未记录'); assert.equal(durationText(1501), '1 天 1 小时');
  console.log('PASS insights: 24-hour reconciliation, real states, refund, previous-period boundaries, scope, active devices, pending age and empty data');
})().catch(error => { console.error(error); process.exitCode = 1; });
