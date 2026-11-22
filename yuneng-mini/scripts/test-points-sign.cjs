const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '../pages/wallet/points.vue');
const source = fs.readFileSync(file, 'utf8')
  .match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '');
const requests = [];
let now = '2026-11-22T15:59:59Z';
let show;

class TestDate extends Date {
  static now() {
    return Date.parse(now);
  }
}

const context = vm.createContext({
  Date: TestDate,
  ref: value => ({ value }),
  request: options => requests.push(options),
  onShow: hook => { show = hook; },
  uni: { getStorageSync: () => 'test-token' }
});
const { signed, sign } = vm.runInContext(`${source}\n;({ signed, sign })`, context);

function refreshWithLedger(rows) {
  show();
  const ledger = requests.splice(0).find(({ url }) => url === 'points/ledger');
  ledger.success({ data: { code: 200, data: rows } });
}

const previousSign = { type: 'DAILY_SIGN', business_key: 'SIGN:2026-11-22' };
refreshWithLedger([previousSign]);
assert.equal(signed.value, true, 'a sign-in on the current Shanghai day blocks a second sign-in');

now = '2026-11-22T16:00:00Z';
refreshWithLedger([previousSign]);
assert.equal(signed.value, false, 'yesterday’s sign-in does not block sign-in after Shanghai midnight');
sign();
assert.equal(requests[0].url, 'points/sign');
