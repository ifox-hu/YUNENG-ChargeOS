// Source-derived HTML preview only: does not claim WeChat runtime compatibility.
const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of [320,390,430]){
 const page=await b.newPage({viewport:{width,height:930}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'../docs/miniapp/profile-layout-preview.html').replaceAll('\\','/'));
 await page.locator('.service-item').first().waitFor();
 const rows=await page.locator('.service-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
 const cols=await page.locator('.month-cell').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));
 assert.equal(rows.length,3);assert(rows.every(h=>h<110));
 assert(Math.max(...cols)-Math.min(...cols)<2);assert.equal(errors.length,0);
 assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 await page.locator('.service-item').nth(1).click();
 assert(await page.evaluate(()=>navigation.includes('/pages/repair/create')));
 await page.locator('.back-button').click();assert(await page.evaluate(()=>navigation.includes('/pages/index/index')));
 if(width===390)await page.screenshot({path:path.resolve(__dirname,'../docs/miniapp/profile-layout-preview.png'),fullPage:true});
 console.log('PASS HTML preview width '+width+': compact entries, aligned stats, no overflow, navigation wiring');
 await page.close();
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

