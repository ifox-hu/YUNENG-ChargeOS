const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function captcha() {
  const file = path.join(__dirname, '../yuneng-admin/src/demo/captcha.js');
  assert(fs.existsSync(file), 'Static Pages captcha is not implemented');
  return import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64'));
}
function answer(challenge) {
  const svg = Buffer.from(challenge.img, 'base64').toString('utf8');
  const code = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map(match => match[1]).join('');
  assert.match(code, /^[2-9A-HJKMNP-Z]{4}$/);
  return code;
}
test('Pages captcha generates images and checks empty, wrong, refreshed, expired and used codes', async () => {
  const { createDemoCaptcha, verifyDemoCaptcha } = await captcha();
  assert.match(verifyDemoCaptcha('', ''), /验证码/);
  const first = createDemoCaptcha(1000);
  assert.equal(first.captchaEnabled, true);
  assert.equal(first.imageType, 'image/svg+xml');
  assert.match(Buffer.from(first.img, 'base64').toString(), /^<svg/);
  const oldCode = answer(first);
  const fresh = createDemoCaptcha(2000);
  assert.notEqual(first.uuid, fresh.uuid);
  assert.match(verifyDemoCaptcha(oldCode, first.uuid, 2001), /失效/);
  assert.match(verifyDemoCaptcha('', fresh.uuid, 2001), /请输入验证码/);
  assert.match(verifyDemoCaptcha('WRONG', fresh.uuid, 2001), /错误/);
  assert.match(verifyDemoCaptcha(answer(fresh), fresh.uuid, 2001), /失效/);
  const valid = createDemoCaptcha(3000);
  assert.equal(verifyDemoCaptcha(' ' + answer(valid).toLowerCase() + ' ', valid.uuid, 3001), null);
  assert.match(verifyDemoCaptcha(answer(valid), valid.uuid, 3002), /失效/);
  const expired = createDemoCaptcha(4000);
  assert.match(verifyDemoCaptcha(answer(expired), expired.uuid, 124000), /过期/);
});
