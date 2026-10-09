import fixtures from './fixtures.json'
const key = 'yuneng-original-ui-demo-v1'
const clone = value => JSON.parse(JSON.stringify(value))
const now = () => new Date().toLocaleString('sv-SE')
const initial = () => ({ lists: clone(fixtures), faults: ['NEW','ASSIGNED','PROCESSING','RESOLVED','CLOSED'].map((status,i)=>({id:1001+i,ticketNo:'GD20261009'+(1001+i),pileId:String(202312121+i),pileName:'演示充电桩 '+(i+1),faultType:['OFFLINE','CONNECTOR','POWER','OTHER'][i%4],source:'ALARM',priority:'NORMAL',status,assigneeId:i?1:null,assigneeName:i?'演示管理员':'',description:'模拟设备故障，请安排检修。',createdAt:now(),logs:[{id:1,toStatus:status,actorName:'演示用户',note:'演示工单初始记录',createdAt:now()}]})), alarmCount:5 })
let db
try { db=JSON.parse(localStorage.getItem(key)) || initial() } catch(e) { db=initial() }
const persist=()=>localStorage.setItem(key,JSON.stringify(db))
export function resetDemo(){db=initial();persist();location.reload()}
const user={userId:1,userName:'demo',nickName:'演示管理员',avatar:'',deptId:100,tenantId:9999,status:'0',phonenumber:'13800000000',email:'demo@example.com',dept:{deptName:'运营部'}}
const samples={
 '/system/user/list':[user],
 '/system/role/list':[{roleId:1,roleName:'演示管理员',roleKey:'admin',roleSort:1,status:'0',createTime:now()}],
 '/system/post/list':[{postId:1,postName:'运营管理',postCode:'demo',postSort:1,status:'0'}],
 '/system/notice/list':[{noticeId:1,noticeTitle:'欢迎体验模拟运营后台',noticeType:'1',noticeContent:'全部操作仅修改浏览器演示数据。',status:'0',createBy:'demo',createTime:now()}],
 '/system/tenant/list':[{tenantId:9999,companyName:'演示运营商',contactUserName:'演示联系人',contactPhone:'13800000000',status:'0'}],
 '/system/tenantpackage/list':[{packageId:1,packageName:'演示运营套餐',status:'0',remark:'静态演示'}],
 '/system/config/list':[{configId:1,configName:'演示开关',configKey:'demo.enabled',configValue:'true',configType:'Y'}],
 '/system/dict/type/list':[{dictId:1,dictName:'充电桩类型',dictType:'pile_type',status:'0'}],
 '/monitor/online/list':[{tokenId:'DEMO_ONLY',userName:'demo',ipaddr:'127.0.0.1',loginTime:now()}],
 '/demo/demo/list':[{demoId:1,name:'演示数据',remark:'浏览器模拟记录'}]
}
Object.entries(samples).forEach(([url,rows])=>{if(!db.lists[url])db.lists[url]={code:200,data:clone(rows),rows:clone(rows),total:rows.length}})
const ok=data=>({code:200,msg:'演示操作成功',data})
const fail=msg=>({code:500,msg})
const primaryKeys={station:'stationId',pile:'pileId',port:'portId',order:'orderId',member:'memberId',balance:'id',rule:'ruleId',price:'id',city:'id',miniapp:'id',user:'userId',role:'roleId',post:'postId',notice:'noticeId',tenant:'tenantId',tenantpackage:'packageId',config:'configId',type:'dictId',demo:'demoId'}
function listResponse(rows,query,original={}) {
  const filtered=rows.filter(row=>Object.entries(query).every(([k,v])=>!v||['pageNum','pageSize','orderByColumn','isAsc'].includes(k)||!(k in row)||String(row[k]??'').includes(v)))
  const size=Math.max(1,Number(query.pageSize)||10), page=Math.max(1,Number(query.pageNum)||1)
  const data=filtered.slice((page-1)*size,page*size)
  return {...original,...ok(data),rows:data,total:filtered.length}
}
function handle(config) {
 const parsed=new URL(config.url,'https://demo.invalid'),url=parsed.pathname,q=Object.fromEntries(parsed.searchParams);let b=config.data||{}
 if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b=Object.fromEntries(new URLSearchParams(b))}}
 const method=(config.method||'get').toLowerCase()
 if(url==='/code')return {...ok(null),captchaEnabled:false}
 if(url==='/auth/login')return ok({access_token:'DEMO_BROWSER_ONLY',expires_in:7200,tenant_id:9999})
 if(url==='/auth/logout'||url==='/auth/refresh')return ok(7200)
 if(url==='/system/user/getInfo')return {...ok(null),user,roles:['admin'],permissions:['*:*:*']}
 if(url.includes('/config/configKey/'))return ok('false')
 if(url==='/system/user/profile')return {...ok(user),roleGroup:'演示管理员',postGroup:'运营'}
 if(url==='/demo/operation-logs')return ok(db.faults.flatMap(t=>t.logs.map(l=>({...l,ticketNo:t.ticketNo}))))
 if(url.includes('/fault'))return fault(url,method,b,q)
 if(url.startsWith('/simulator/evcs/sim/v1/')){
  const args={...q,...b},action=url.split('/').pop(),ports=db.lists['/operator/port/list'].rows||db.lists['/operator/port/list'].data
  const target=ports.filter(r=>r.pileId===args.pileId&&(!args.deviceId||String(r.deviceId)===String(args.deviceId)))
  if(!target.length)return fail('没有匹配的模拟端口')
  target.forEach(r=>{if(action==='start')r.runningStatus=2;else if(action==='stop'){r.runningStatus=1;r.gunStatus=0}else if(action==='link')r.gunInsert=1;else if(action==='unlink'){r.gunInsert=0;r.gunStatus=0}else if(action==='startCharge')r.gunStatus=1;else if(action==='endCharge')r.gunStatus=0});persist();return ok('模拟状态已更新')
 }
 if(db.lists[url]&&method==='get'){const r=clone(db.lists[url]);if(Array.isArray(r.rows)||url.endsWith('/list'))return listResponse(r.rows||r.data||[],q,r);return r}
 if(db.lists[url]&&url.includes('/total/'))return clone(db.lists[url])
 if(url==='/system/user/userList'||url==='/system/user/getUserList')return listResponse([user],q)
 if(url==='/system/user/'||url==='/system/user/1')return {...ok(url.endsWith('/1')?user:null),roles:samples['/system/role/list'],posts:samples['/system/post/list'],roleIds:[1],postIds:[1]}
 if(url==='/system/menu/list')return ok(fixtures['/system/menu/getRouters'].data.map((r,i)=>({menuId:i+1,menuName:r.meta.title,parentId:0,path:r.path,menuType:'M',orderNum:i,status:'0',visible:'0'})))
 if(url==='/job/group/getSelectAll')return ok([{id:1,appName:'demo',title:'演示执行器',addressType:0,addressList:''}])
 if(/dept/i.test(url)&&/tree|list/i.test(url))return {...ok([{id:100,label:'运营部',deptId:100,deptName:'运营部',parentId:0,children:[]}]),rows:[]}
 if(url.includes('role')&&url.endsWith('/list'))return listResponse([{roleId:1,roleName:'演示管理员',roleKey:'admin',status:'0',roleSort:1}],q)
 if(url.includes('post')&&url.endsWith('/list'))return listResponse([{postId:1,postName:'运营管理',postCode:'demo',status:'0',postSort:1}],q)
 if(url.includes('/dict/data/type/'))return ok([])
 if(url.includes('/getOrderByOrderNumber/'))return ok((db.lists['/operator/order/list'].rows||db.lists['/operator/order/list'].data).find(r=>r.orderNumber===url.split('/').pop())||{})
 const base=url.replace(/\/(list|\d+|[\d,]+|add|edit)$/,'');const collection=db.lists[base+'/list'];
 if(collection){const rows=collection.rows||collection.data||[];const idKey=primaryKeys[base.split('/').pop()]||Object.keys(rows[0]||{}).find(k=>/Id$/.test(k)&&k!=='tenantId')||'id';const id=url.split('/').pop();if(method==='get')return ok(rows.find(r=>String(r[idKey])===id)||{});if(method==='post'||method==='put'){if(method==='put'){const i=rows.findIndex(r=>String(r[idKey])===String(b[idKey]));if(i<0)return fail('演示记录不存在');rows.splice(i,1,{...rows[i],...b})}else rows.unshift({...b,[idKey]:b[idKey]||Date.now(),createTime:now()});persist();return ok(null)}if(method==='delete'){const ids=id.split(',');collection.rows=rows.filter(r=>!ids.includes(String(r[idKey])));collection.data=collection.rows;persist();return ok(null)}}
 if(method==='get'&&/list|select|tree|List/.test(url))return {...ok([]),rows:[],total:0}
 return fail('此操作尚未接入模拟接口：'+url+'。演示不会连接真实服务。')
}
function fault(url,method,b,q){const id=Number(url.split('/')[3]);const ticket=db.faults.find(t=>t.id===id)
 if(url.endsWith('/list')){const r=listResponse(db.faults,q);return ok({records:r.rows,total:r.total})}
 if(url.endsWith('/stats'))return ok({total:db.faults.length,active:db.faults.filter(t=>t.status!=='CLOSED').length,pending:db.faults.filter(t=>t.status==='NEW').length,closed:db.faults.filter(t=>t.status==='CLOSED').length,alarmCount:db.alarmCount,avgResolveMinutes:35,trend:[{day:new Date().toISOString().slice(0,10),count:db.faults.length}],byType:['OFFLINE','CONNECTOR','POWER','OTHER'].map(faultType=>({faultType,count:db.faults.filter(t=>t.faultType===faultType).length}))})
 if(url.endsWith('/simulate-alarm')){if(!b.pileId||!b.description)return fail('请填写设备和描述');db.alarmCount++;const old=db.faults.find(t=>t.pileId===b.pileId&&t.faultType===b.faultType&&t.status!=='CLOSED');if(old){persist();return ok({merged:true,ticket:old})}const t={...b,id:Date.now(),ticketNo:'GD'+Date.now(),status:'NEW',source:'ALARM',createdAt:now(),logs:[]};db.faults.unshift(t);persist();return ok({merged:false,ticket:t})}
 if(url.endsWith('/assignees'))return ok([user])
 if(!ticket)return fail('工单不存在')
 if(method==='post'){const allowed={ASSIGN:['NEW','ASSIGNED'],START:['ASSIGNED'],RESOLVE:['PROCESSING'],CONFIRM:['RESOLVED']};if(!allowed[b.action]?.includes(ticket.status))return fail('当前状态不允许该操作');if(!b.note)return fail('请填写处理说明');if(b.action==='ASSIGN'){if(!b.assigneeId)return fail('请选择处理人');ticket.assigneeId=1;ticket.assigneeName=user.nickName}ticket.status={ASSIGN:'ASSIGNED',START:'PROCESSING',RESOLVE:'RESOLVED',CONFIRM:'CLOSED'}[b.action];ticket.logs.push({id:Date.now(),toStatus:ticket.status,actorName:user.nickName,note:b.note,createdAt:now()});persist()}
 return ok({ticket,logs:ticket.logs,reports:[]})
}
export async function demoAdapter(config){let data;try{data=handle(config)}catch(e){data=fail('模拟接口处理失败：'+e.message)}return {data:clone(data),status:200,statusText:'OK',headers:{},config,request:{responseType:config.responseType}}}
