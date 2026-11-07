const assert = require('node:assert/strict');

async function readDemoCaptcha(page) {
  const image = page.locator('.login-code-img');
  await image.waitFor();
  await page.waitForFunction(() => {
    const img = document.querySelector('.login-code-img');
    return img && img.src.startsWith('data:image/svg+xml;base64,') && img.complete && img.naturalWidth > 0;
  });
  const source = await image.getAttribute('src');
  const svg = Buffer.from(source.split(',')[1], 'base64').toString('utf8');
  const code = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map(match => match[1]).join('');
  assert.match(code, /^[2-9A-HJKMNP-Z]{4}$/);
  return code;
}
async function fillDemoCaptcha(page) {
  await page.getByPlaceholder('请输入右侧验证码').fill(await readDemoCaptcha(page));
}
module.exports = { readDemoCaptcha, fillDemoCaptcha };
