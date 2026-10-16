const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../yuneng-admin/src/demo/telemetry.js'), 'utf8');
  const { seedDemoPorts, refreshDemoPorts, simulateDemoPorts } = await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
  );
  const fixtures = require('../yuneng-admin/src/demo/fixtures.json');
  const ports = JSON.parse(JSON.stringify(fixtures['/operator/port/list'].data));
  const start = 1000000;
  seedDemoPorts(ports, start);
  const first = ports[0];
  const args = { pileId: first.pileId, deviceId: first.deviceId };
  assert.equal(first.chargingCurrent, 32);
  assert.equal(first.chargingCdgl / first.chargingCurrent, 412);
  assert.equal(first.chargingCdgl / 1000, 13.184);
  assert.equal(first.useCount, 156);
  assert.equal(first.gunInsert, 1);
  assert.equal(ports[2].gunStatus, 0);
  assert.equal(ports[3].gunStatus, 5);
  assert.equal(ports[4].runningStatus, 1);
  for (const port of ports.filter(port => port.gunStatus !== 1)) {
    assert.equal(port.chargingCurrent, 0);
    assert.equal(port.chargingCdgl, 0);
    assert(port.useCount > 0);
  }
  const originalEnergy = first.consumePower;
  refreshDemoPorts(ports, start + 10000);
  assert(Math.abs(first.realHour * 60 - (38.5 + 10 / 60)) < 1e-9);
  assert(Math.abs(first.consumePower - originalEnergy - 13.184 * 10 / 3600) < 1e-9);
  const snapshot = JSON.stringify(first);
  assert(simulateDemoPorts(ports, 'startCharge', args, start + 10000));
  assert.equal(JSON.stringify(first), snapshot, 'a duplicate start must not reset the session');
  assert(simulateDemoPorts(ports, 'unlink', args, start + 10000));
  assert.equal(simulateDemoPorts(ports, 'endCharge', args, start + 10000), null);
  const stopped = { hours: first.realHour, energy: first.consumePower };
  refreshDemoPorts(ports, start + 70000);
  assert.equal(first.chargingCurrent, 0);
  assert.equal(first.chargingCdgl, 0);
  assert.equal(first.realHour, stopped.hours);
  assert.equal(first.consumePower, stopped.energy);
  assert.equal(simulateDemoPorts(ports, 'startCharge', args, start + 70000), null);
  assert.equal(first.useCount, 157);
  assert.equal(first.realHour, 0);
  assert.equal(first.consumePower, 0);
  refreshDemoPorts(ports, start + 130000);
  assert(Math.abs(first.consumePower - 13.184 / 60) < 1e-9);
  assert.equal(simulateDemoPorts(ports, 'stop', args, start + 130000), null);
  assert.equal(first.chargingCurrent, 0);
  assert.equal(first.chargingCdgl, 0);
  assert(simulateDemoPorts(ports, 'startCharge', args, start + 130000));
  assert.equal(simulateDemoPorts(ports, 'start', args, start + 130000), null);
  assert.equal(simulateDemoPorts(ports, 'unlink', args, start + 130000), null);
  assert(simulateDemoPorts(ports, 'startCharge', args, start + 130000));
  assert.equal(simulateDemoPorts(ports, 'link', args, start + 130000), null);
  assert.equal(simulateDemoPorts(ports, 'startCharge', args, start + 130000), null);
  assert(simulateDemoPorts(ports, 'startCharge', { pileId: ports[3].pileId, deviceId: ports[3].deviceId }, start + 130000));
  assert(simulateDemoPorts(ports, 'unknown', args, start + 130000));
  assert(simulateDemoPorts(ports, 'start', { pileId: 'does-not-exist' }, start + 130000));
  console.log('PASS demo seed values, electrical units, timed energy, stop/freeze, new session, duplicate start and invalid state guards');
})().catch(error => { console.error(error); process.exitCode = 1; });
