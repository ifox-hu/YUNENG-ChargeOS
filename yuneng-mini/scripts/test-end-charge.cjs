// Mock-only regression checks; never contacts a backend or stops an order.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../pages/station/powering.vue'), 'utf8');
const begin = source.indexOf('const finish = () =>');
const end = source.indexOf('\n\tonLoad(', begin);
assert.ok(begin >= 0 && end > begin);
function setup(form) {
  const calls = [], messages = [];
  let modal;
  const ctx = {
    form, ending: { value: false },
    request: options => calls.push(options),
    uni: { showModal: options => { modal = options; }, showToast: options => messages.push(options.title) },
    setTimeout: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(begin, end) + '\nthis.finish = finish;', ctx);
  return { ctx, calls, messages, confirm: () => modal.success({ confirm: true }), cancel: () => modal.success({ confirm: false }) };
}
let t = setup({ pileId: '202312121', port: '2', portId: '2745', orderNumber: 'test-only' });
t.ctx.finish(); t.confirm(); t.ctx.finish();
assert.equal(t.calls.length, 1, 'prevent repeated submissions');
assert.equal(t.calls[0].data.port, '2745', 'prefer database port ID over hardware port number');
t.calls[0].success({ data: { code: 500, msg: '端口信息未找到' } });
assert.equal(t.messages[0], '端口信息未找到');
assert.equal(t.ctx.ending.value, false);
t = setup({ pileId: '202312121', port: '2745' });
t.ctx.finish(); t.confirm();
assert.equal(t.calls[0].data.port, '2745', 'support existing order-list routes');
t.calls[0].fail();
assert.equal(t.ctx.ending.value, false, 'allow retry after network failure');
t = setup({ pileId: '202312121' });
t.ctx.finish();
assert.equal(t.calls.length, 0, 'reject incomplete parameters');
t = setup({ pileId: '202312121', portId: '2745' });
t.ctx.finish(); t.cancel();
assert.equal(t.calls.length, 0, 'cancel never sends a request');
assert.equal(t.ctx.ending.value, false);
console.log('PASS: port ID mapping, duplicate prevention, backend/network failure, missing data, cancellation');
