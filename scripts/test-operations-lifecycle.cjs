// 确认框等待期间离开原页面，不能再提交旧页面的写操作；不访问后端。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Vue = require('../yuneng-admin/node_modules/vue/dist/vue.common.js');

for (const [name, action, row] of [
  ['marketing', 'issue', { id: 7, name: '验证券' }],
  ['finance', 'note', { id: 8 }],
  ['orders', 'voidZero', { order_id: 'VERIFY' }]
]) {
  for (const lifecycle of ['destroyed', 'deactivated']) {
  test(`${name}: ${lifecycle} page cannot submit a pending confirmation`, async () => {
    const file = path.resolve(__dirname, `../yuneng-admin/src/views/operator/operations/${name}.vue`);
    const source = fs.readFileSync(file, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
    const writes = [];
    const sandbox = {
      OperationScope: {}, formatMoney: String, operationKey: () => 'verify',
      getOperations: async () => ({ data: {} }), saveOperation: (...args) => writes.push(args)
    };
    vm.runInNewContext(source.replace(/^import .*$/gm, '').replace('export default', 'component ='), sandbox);
    const instance = new Vue({ ...sandbox.component, created() {},
      beforeCreate() { this.$route = { query: {} }; }
    });
    let confirm;
    let closed = 0;
    instance.$msgbox = { close() { closed++; } };
    instance.$prompt = () => new Promise(resolve => { confirm = resolve; });
    instance.mutate = (...args) => writes.push(args);
    instance.load = () => {};
    instance.refreshFunds = () => {};
    const pending = instance[action](row);
    if (lifecycle === 'deactivated') instance.$options.deactivated.forEach(hook => hook.call(instance));
    instance.$destroy();
    confirm({ value: '99' });
    await pending;
    assert.equal(writes.length, 0);
    assert.equal(closed, 1);
  });
  }
}
