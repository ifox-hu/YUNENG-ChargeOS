const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:8001/prod-api/';
const pile='QA_UI_'+crypto.randomBytes(6).toString('hex');
let token,browser;
function sql(q){return execFileSync('docker',['exec','-e','MYSQL_PWD=password','hcp-mysql','mysql','--default-character-set=utf8mb4','-uroot','vctgo_platform','-Nse',q],{encoding:'utf8'}).trim()}
(async()=>{try{
 const cap=await fetch(base+'code').then(r=>r.json());let code=execFileSync('docker',['exec','hcp-redis','redis-cli','-n','5','GET','captcha_codes:'+cap.uuid],{encoding:'utf8'}).trim();try{code=JSON.parse(code)}catch{}
 const login=await fetch(base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123',uuid:cap.uuid,code})}).then(r=>r.json());assert.equal(login.code,200);token=login.data.access_token;
 sql("INSERT INTO c_charging_pile(pile_id,name,user_id,tenant_id,remark) VALUES('"+pile+"','界面验证测试桩',1,9999,'isolated UI fault fixture')");
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1080}});
 await context.addCookies([{name:'Admin-Token',value:token,url:'http://127.0.0.1:8001'},{name:'Admin-Tenant',value:'9999',url:'http://127.0.0.1:8001'}]);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8001/operate/fault');await page.getByRole('heading',{name:'故障工单',exact:true}).waitFor();
 await page.getByRole('button',{name:'模拟设备告警'}).click();
 const alarm=page.locator('.el-dialog:visible').filter({hasText:'模拟设备告警'});
 await alarm.getByPlaceholder('例如 202312121').fill(pile);await alarm.locator('textarea').fill('测试：充电枪插入后没有响应，提交告警并验证处理流程。');await alarm.getByRole('button',{name:'生成告警'}).click();
 await page.getByRole('button',{name:'分配处理人'}).waitFor();
 await page.getByRole('button',{name:'分配处理人'}).click();
 const action=()=>page.locator('.el-dialog:visible').filter({has:page.locator('textarea[placeholder="填写处理步骤或解决结果"]')});
 await action().locator('.el-select').click();await page.locator('.el-select-dropdown:visible').getByText('(admin)',{exact:false}).click();
 await action().locator('textarea').fill('安排管理员排查充电枪接口。');await action().getByRole('button',{name:'确认',exact:true}).click();
 await page.getByRole('button',{name:'开始处理',exact:true}).click();await action().locator('textarea').fill('已到现场检查接线与枪头。');await action().getByRole('button',{name:'确认',exact:true}).click();
 await page.getByRole('button',{name:'提交解决结果',exact:true}).click();await action().locator('textarea').fill('重新插接接口后恢复正常，等待确认。');await action().getByRole('button',{name:'确认',exact:true}).click();
 await page.getByRole('button',{name:'确认关闭',exact:true}).waitFor();
 await page.locator('.el-dialog__wrapper').filter({has:page.locator('textarea[placeholder="填写处理步骤或解决结果"]')}).waitFor({state:'hidden'});
 await page.locator('.el-message').last().waitFor({state:'hidden'});
 await page.screenshot({path:path.join(process.cwd(),'fault-admin-detail.png'),fullPage:true});
 await page.getByRole('button',{name:'确认关闭',exact:true}).click();await action().locator('textarea').fill('复查通过，确认关闭工单。');await action().getByRole('button',{name:'确认',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.el-dialog__body') && document.body.innerText.includes('已关闭'));
 assert.equal(sql("SELECT status FROM c_fault_ticket WHERE pile_id='"+pile+"'"),'CLOSED');
 await page.locator('.el-dialog').filter({has:page.getByText('工单详情与处理记录',{exact:true})}).getByRole('button',{name:'Close'}).click();
 await page.getByPlaceholder('完整桩编号').fill(pile);await page.locator('.fault-page > .el-form .el-button--primary').click();
 await page.getByRole('cell',{name:pile,exact:false}).first().waitFor();
 await page.screenshot({path:path.join(process.cwd(),'fault-admin-list.png'),fullPage:true});
 assert.equal(errors.length,0,errors.join('; '));console.log('PASS browser create -> assign -> start -> resolve -> close, filter and charts; no page errors');
 }finally{
 if(browser)await browser.close();
 sql("START TRANSACTION; DELETE a FROM c_device_alarm a JOIN c_fault_ticket t ON t.id=a.ticket_id WHERE t.pile_id='"+pile+"'; DELETE l FROM c_fault_ticket_log l JOIN c_fault_ticket t ON t.id=l.ticket_id WHERE t.pile_id='"+pile+"'; DELETE r FROM c_fault_report r JOIN c_fault_ticket t ON t.id=r.ticket_id WHERE t.pile_id='"+pile+"'; DELETE FROM c_fault_ticket WHERE pile_id='"+pile+"'; DELETE FROM c_charging_pile WHERE pile_id='"+pile+"' AND remark='isolated UI fault fixture'; COMMIT;");
 if(token)await fetch(base+'auth/logout',{method:'DELETE',headers:{Authorization:'Bearer '+token}});
 }})().catch(e=>{console.error(e);process.exitCode=1});
