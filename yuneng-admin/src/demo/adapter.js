import fixtures from './fixtures.json'
import { prepareAdminSamples } from './adminSamples'
import { seedDemoPorts, refreshDemoPorts, simulateDemoPorts } from './telemetry'
import { handleDemoAlarms, prepareDemoAlarmScopes } from './alarms'
import { createDemoCaptcha } from './captcha'
import { createDemoSession } from './authentication'
import { prepareOperatorDemo, handleDemoOperators } from './operators'
import { prepareOperationsDemo, prepareOperationsSamples, handleOperations } from './operations'
import { demoOverview } from './overview'
import { prepareDashboardSamples } from './dashboardSamples'
import { prepareDemoStationLocations } from './stationLocations'
import { demoTenantRole, getDemoSession, updateDemoSession } from './session'
import { businessToday } from '../views/operations/period'
const key = 'yuneng-original-ui-demo-v1'
const clone = value => JSON.parse(JSON.stringify(value))
const now = () => new Date().toLocaleString('sv-SE')
const initial = () => ({ lists: clone(fixtures), faults: ['NEW','ASSIGNED','PROCESSING','RESOLVED','CLOSED'].map((status,i)=>({id:1001+i,ticketNo:'GD20261009'+(1001+i),pileId:String(202312121+i),pileName:'演示充电桩 '+(i+1),faultType:['OFFLINE','CONNECTOR','POWER','OTHER'][i%4],source:'ALARM',priority:'NORMAL',status,assigneeId:i?1:null,assigneeName:i?'演示管理员':'',description:'模拟设备故障，请安排检修。',createdAt:now(),logs:[{id:1,toStatus:status,actorName:'演示用户',note:'演示工单初始记录',createdAt:now()}]})), alarmCount:5 })
let db
try { db=JSON.parse(localStorage.getItem(key)) || initial() } catch(e) { db=initial() }
const persist=()=>localStorage.setItem(key,JSON.stringify(db))
function prepareTelemetry() {
  const collection = db.lists['/operator/port/list']
  const ports = collection.rows || collection.data || []
  if (db.portTelemetryVersion !== 1) {
    seedDemoPorts(ports)
    db.portTelemetryVersion = 1
  } else {
    // Continue saved sessions from their last readings when reopening the demo.
    ports.forEach(port => { if (port._demoTelemetry) port._demoTelemetry.at = Date.now() })
  }
  collection.data = ports
  if (collection.rows) collection.rows = ports
  persist()
}
prepareTelemetry()
export function resetDemo(){localStorage.removeItem(key);location.reload()}
const user={userId:1,userName:'admin',nickName:'演示平台管理员',avatar:'',deptId:100,tenantId:9999,status:'0',phonenumber:'13800000000',email:'demo@example.com',dept:{deptName:'运营部'}}
const tenantUser={...user,userId:2,userName:'demo',nickName:'演示运营商',email:'demo@example.com'}
const tenantPermissions=['operator:station:list','operator:order:list','operator:fault:list']
const samples={
 '/system/user/list':[user],
 '/system/role/list':[{roleId:1,roleName:'演示管理员',roleKey:'admin',roleSort:1,status:'0',createTime:now()}],
 '/system/post/list':[{postId:1,postName:'运营管理',postCode:'demo',postSort:1,status:'0'}],
 '/system/notice/list':[{noticeId:1,noticeTitle:'欢迎体验模拟运营后台',noticeType:'1',noticeContent:'全部操作仅修改浏览器演示数据。',status:'0',createBy:'demo',createTime:now()}],
 '/system/tenant/list':[{tenantId:9999,companyName:'演示运营商',contactUserName:'演示联系人',contactPhone:'13800000000',status:'0'}],
 '/system/tenantpackage/list':[{packageId:1,packageName:'演示运营套餐',status:'0',remark:'静态演示'}],
 '/system/config/list':[{configId:1,configName:'演示开关',configKey:'demo.enabled',configValue:'true',configType:'Y'}],
 '/system/dict/type/list':[{dictId:1,dictName:'充电桩类型',dictType:'pile_type',status:'0'}],
 '/demo/demo/list':[{demoId:1,name:'演示数据',remark:'浏览器模拟记录'}]
}
Object.entries(samples).forEach(([url,rows])=>{if(!db.lists[url])db.lists[url]={code:200,data:clone(rows),rows:clone(rows),total:rows.length}})
prepareAdminSamples(db)
prepareOperatorDemo(db)
prepareOperationsDemo(db)
prepareOperationsSamples(db)
const sampleDay = businessToday()
prepareDashboardSamples(db, sampleDay, Math.floor((Date.now() - Date.parse(sampleDay + 'T00:00:00+08:00')) / 1000))
prepareDemoStationLocations(db)
// Backend file IDs have no public image equivalent on the static host.
const stations = db.lists['/operator/station/list']
for (const station of stations.rows || stations.data || []) {
  if (!/^(data:|https?:|\.?\/)/.test(station.fileId || '')) station.fileId = './yuneng-blue.svg'
}
prepareDemoAlarmScopes(db)
handleDemoAlarms(db,'/operator/fault/alarms','get')
persist()
const ok=data=>({code:200,msg:'演示操作成功',data})
const fail=(msg,code=500)=>({code,msg})
const forbidden=()=>fail('此账号无权访问该演示功能或数据',403)
const rows=url=>{const collection=db.lists[url]||{};return collection.rows||collection.data||[]}
const same=(a,b)=>String(a)===String(b)
const visible=(identity,row)=>identity.root||same(row.tenantId,identity.tenantId)
const tenantRead=/^\/operator\/(?:overview|station\/[^/]+(?:\/devices)?|order\/(?:getOrderByOrderNumber\/)?[^/]+|fault\/(?:list|stats|\d+|alarms(?:\/\d+)?))$/
const tenantCommon=/^\/system\/(?:menu\/getRouters|user\/getInfo|dict\/data\/type\/\w+|config\/configKey\/[\w.]+)$/
const primaryKeys={station:'stationId',pile:'pileId',port:'portId',order:'orderId',member:'memberId',balance:'id',rule:'ruleId',price:'id',city:'id',miniapp:'id',user:'userId',role:'roleId',post:'postId',notice:'noticeId',tenant:'id',tenantpackage:'id',config:'configId',type:'dictId',demo:'demoId',online:'tokenId',operlog:'operId',logininfor:'infoId',data:'dictCode'}
function listResponse(rows,query,original={}) {
  const filtered=rows.filter(row=>Object.entries(query).every(([k,v])=>!v||['pageNum','pageSize','orderByColumn','isAsc'].includes(k)||!(k in row)||(['tenantId','stationId'].includes(k)?String(row[k])===String(v):String(row[k]??'').includes(v))))
  const size=Math.max(1,Number(query.pageSize)||10), page=Math.max(1,Number(query.pageNum)||1)
  const data=filtered.slice((page-1)*size,page*size)
  return {...original,...ok(data),rows:data,total:filtered.length}
}
function menuRows(routes, parentId = 0, result = []) {
  routes.forEach((route,index) => {
    const menuId=result.length+1
    result.push({menuId,menuName:route.meta.title,parentId,path:route.path,component:route.component,
      menuType:route.children?'M':'C',orderNum:index+1,status:'0',visible:route.hidden?'1':'0'})
    if(route.children)menuRows(route.children,menuId,result)
  })
  return result
}
function handle(config) {
 const parsed=new URL(config.url,'https://demo.invalid'),url=parsed.pathname,q=Object.fromEntries(parsed.searchParams);let b=config.data||{}
 if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b=Object.fromEntries(new URLSearchParams(b))}}
 const method=(config.method||'get').toLowerCase()
 if(url==='/code')return {...ok(null),...createDemoCaptcha()}
 if(url==='/auth/login'){
  try { return ok(createDemoSession(b)) } catch (error) { return fail(error.message) }
 }
 const identity=getDemoSession(config.headers)
 if(!identity)return fail('演示会话已过期，请重新登录',401)
 if(url==='/auth/logout'&&method==='delete')return ok(updateDemoSession(identity,true))
 if(url==='/auth/refresh'&&method==='post')return ok(updateDemoSession(identity,false))
 if(!identity.root){
   if(method!=='get'||!(tenantRead.test(url)||tenantCommon.test(url)))return forbidden()
   if(q.tenantId&&!same(q.tenantId,identity.tenantId))return forbidden()
   if(q.stationId&&!rows('/operator/station/list').some(row=>visible(identity,row)&&same(row.stationId,q.stationId)))return forbidden()
 }
 if(url==='/system/user/getInfo'){
  const operator=rows('/system/tenant/list').find(row=>same(row.id,identity.tenantId))
  const profile=identity.root?user:{...tenantUser,tenantId:identity.tenantId,nickName:operator?.tenantName||tenantUser.nickName}
  return {...ok(null),user:profile,roles:[identity.root?'admin':demoTenantRole],permissions:identity.root?['*:*:*']:tenantPermissions}
 }
 if(url==='/system/menu/getRouters'&&!identity.root){
  const route=db.lists[url].data.find(route=>route.path==='/operate')
  return ok([{...route,children:route.children.filter(child=>['station','order','ordertDetail','fault'].includes(child.path))}])
 }
 const operationResult=handleOperations(db,url,method,b,q)
 if(operationResult){persist();return operationResult}
 if(url==='/operator/overview'){handleDemoAlarms(db,'/operator/fault/alarms','get',{},{});persist();return ok(demoOverview(db,q,identity))}
 if(url==='/operator/station/list'&&!identity.root)return listResponse(rows(url).filter(row=>visible(identity,row)),q)
 const stationDevices=url.match(/^\/operator\/station\/([^/]+)\/devices$/)
 if(stationDevices&&method==='get'){
  const station=rows('/operator/station/list').find(row=>visible(identity,row)&&same(row.stationId,decodeURIComponent(stationDevices[1]))&&(!q.tenantId||same(row.tenantId,q.tenantId))&&!Number(row.delFlag))
  if(!station)return fail('站点不存在',404)
  const owned=row=>same(row.tenantId,station.tenantId)
  const portsByPile=new Map()
  for(const port of rows('/operator/port/list').filter(port=>owned(port)&&!Number(port.deleted)&&!Number(port.delFlag))){
    const pileId=String(port.pileId)
    if(!portsByPile.has(pileId))portsByPile.set(pileId,[])
    portsByPile.get(pileId).push(port)
  }
  const piles=rows('/operator/pile/list')
    .filter(pile=>owned(pile)&&same(pile.stationId,station.stationId)&&!Number(pile.deleted))
    .map(pile=>({...pile,ports:portsByPile.get(String(pile.pileId))||[]}))
  return ok({station,piles})
 }
 if(url==='/operator/order/list'&&method==='get') {
   const byTenant=(tenantId,id)=>tenantId+':'+id
   const piles=new Map(rows('/operator/pile/list').map(pile=>[byTenant(pile.tenantId,pile.pileId),pile]))
   const stations=new Map(rows('/operator/station/list').map(station=>[byTenant(station.tenantId,station.stationId),station]))
   const orders=rows(url).filter(order=>visible(identity,order)).map(order=>{
     const stationId=piles.get(byTenant(order.tenantId,order.pileId))?.stationId
     const station=stations.get(byTenant(order.tenantId,stationId))
     return {...order,stationId,stationName:station?.stationName}
   }).filter(order=>(!q.startTime||String(order.createTime).slice(0,10)>=q.startTime)&&(!q.endTime||String(order.createTime).slice(0,10)<=q.endTime))
   const filters={...q};delete filters.startTime;delete filters.endTime
   return listResponse(orders,filters)
 }
 const detail=url.match(/^\/operator\/(station|order)\/(getOrderByOrderNumber\/)?([^/]+)$/)
 if(detail&&method==='get'&&(detail[1]==='order'||!identity.root)){
  const [,resource,byNumber,id]=detail
  const field=byNumber?'orderNumber':primaryKeys[resource]
  const row=rows('/operator/'+resource+'/list').find(row=>visible(identity,row)&&same(row[field],decodeURIComponent(id)))
  return row?ok(row):fail('演示记录不存在',404)
 }
 if(url==='/system/tenantpackage/get-simple-list')return ok(rows('/system/tenantpackage/list').filter(row=>same(row.status,0)))
 const operatorResult=handleDemoOperators(db,url,method,b,q)
 if(operatorResult){persist();return operatorResult}
 if(url==='/system/dict/data/type/sys_tenant_status')return ok([{dictLabel:'正常',dictValue:'0',dictSort:1,status:'0'},{dictLabel:'停用',dictValue:'1',dictSort:2,status:'0'}])
 if(url.includes('/config/configKey/'))return ok('false')
 if(url==='/system/user/profile')return {...ok(user),roleGroup:'演示管理员',postGroup:'运营'}
 if(url==='/demo/operation-logs')return ok(db.faults.flatMap(t=>t.logs.map(l=>({...l,ticketNo:t.ticketNo}))))
 if(url==='/operator/fault/alarms'||url.startsWith('/operator/fault/alarms/')){const result=handleDemoAlarms(db,url,method,b,q,Date.now(),identity.root?q.tenantId:identity.tenantId);persist();return result}
 if(url.includes('/fault'))return fault(url,method,b,q,identity)
 if(url.startsWith('/simulator/evcs/sim/v1/')){
  const args={...q,...b},action=url.split('/').pop(),ports=db.lists['/operator/port/list'].rows||db.lists['/operator/port/list'].data
  const error=simulateDemoPorts(ports,action,args)
  if(error)return fail(error)
  persist();return ok('模拟状态已更新')
 }
 if(url==='/operator/port/list'&&method==='get'){
  const collection=db.lists[url]
  refreshDemoPorts(collection.rows||collection.data||[])
  persist()
 }
 if(url==='/system/dept/list'||url==='/system/user/deptTree')return ok(rows('/system/dept/list').filter(row=>!q.deptName||row.deptName.includes(q.deptName)).map(row=>url.endsWith('deptTree')?{...row,id:row.deptId,label:row.deptName}:row))
 if(url.startsWith('/system/dept/list/exclude/'))return ok(rows('/system/dept/list').filter(row=>!same(row.deptId,url.split('/').pop())))
 if(db.lists[url]&&method==='get'){const r=clone(db.lists[url]);if(Array.isArray(r.rows)||url.endsWith('/list'))return listResponse(r.rows||r.data||[],q,r);return r}
 if(db.lists[url]&&url.includes('/total/'))return clone(db.lists[url])
 if(url==='/system/user/userList'||url==='/system/user/getUserList')return listResponse([user],q)
 if(method==='get'&&/^\/system\/user\/\d*$/.test(url)){
  const id=url.split('/').pop()
  const account=rows('/system/user/list').find(row=>same(row.userId,id))
  return {...ok(account||null),roles:rows('/system/role/list'),posts:rows('/system/post/list'),roleIds:account?[account.userId]:[],postIds:account?[account.userId]:[]}
 }
 if(url==='/system/menu/list')return ok(menuRows(db.lists['/system/menu/getRouters'].data).filter(row=>!q.menuName||row.menuName.includes(q.menuName)))
 if(url==='/job/group/getSelectAll')return ok(rows('/job/group/list'))
 if(url==='/job/log/logDetailCat'){
  const log=rows('/job/log/list').find(row=>same(row.id,q.id??b.id))
  const escapeHtml=value=>String(value??'').replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[char])
  return log?ok({fromLineNum:1,toLineNum:2,end:true,logContent:[log.triggerMsg,log.handleMsg].map(escapeHtml).join('<br>')}):fail('演示日志不存在',404)
 }
 if(method==='get'&&/^\/job\/log\/\d+$/.test(url)){
  const log=rows('/job/log/list').find(row=>same(row.id,url.split('/').pop()))
  return log?ok(log):fail('演示日志不存在',404)
 }
 if(/dept/i.test(url)&&/tree|list/i.test(url))return {...ok([{id:100,label:'运营部',deptId:100,deptName:'运营部',parentId:0,children:[]}]),rows:[]}
 if(url.includes('role')&&url.endsWith('/list'))return listResponse([{roleId:1,roleName:'演示管理员',roleKey:'admin',status:'0',roleSort:1}],q)
 if(url.includes('post')&&url.endsWith('/list'))return listResponse([{postId:1,postName:'运营管理',postCode:'demo',status:'0',postSort:1}],q)
 if(url.includes('/dict/data/type/'))return ok(rows('/system/dict/data/list').filter(row=>row.dictType===url.split('/').pop()))
 const base=url.replace(/\/(list|\d+|[\d,]+|add|edit)$/,'');const collection=db.lists[base+'/list'];
 if(collection){const rows=collection.rows||collection.data||[];const idKey=primaryKeys[base.split('/').pop()]||Object.keys(rows[0]||{}).find(k=>/Id$/.test(k)&&k!=='tenantId')||'id';const id=url.split('/').pop();if(method==='get')return ok(rows.find(r=>String(r[idKey])===id)||{});if(method==='post'||method==='put'){if(method==='put'){const i=rows.findIndex(r=>String(r[idKey])===String(b[idKey]));if(i<0)return fail('演示记录不存在');rows.splice(i,1,{...rows[i],...b})}else rows.unshift({...b,[idKey]:b[idKey]||Date.now(),createTime:now()});persist();return ok(null)}if(method==='delete'){const ids=id.split(',');collection.rows=rows.filter(r=>!ids.includes(String(r[idKey])));collection.data=collection.rows;persist();return ok(null)}}
 if(method==='get'&&/list|select|tree|List/.test(url))return {...ok([]),rows:[],total:0}
 return fail('此操作尚未接入模拟接口：'+url+'。演示不会连接真实服务。')
}
function fault(url,method,b,q,identity){
 const id=Number(url.split('/')[3])
 const piles=rows('/operator/pile/list')
 const scoped=db.faults.filter(t=>visible(identity,t)&&(!q.tenantId||same(t.tenantId,q.tenantId))&&(!q.pileId||same(t.pileId,q.pileId))&&(!q.stationId||piles.some(p=>same(p.pileId,t.pileId)&&same(p.tenantId,t.tenantId)&&same(p.stationId,q.stationId))))
 const ticket=scoped.find(t=>t.id===id)
 if(url.endsWith('/list')){const r=listResponse(scoped.filter(t=>q.activeOnly!=='true'||t.status!=='CLOSED'),q);return ok({records:r.rows,total:r.total})}
 if(url.endsWith('/stats'))return ok({total:scoped.length,active:scoped.filter(t=>t.status!=='CLOSED').length,pending:scoped.filter(t=>t.status==='NEW').length,closed:scoped.filter(t=>t.status==='CLOSED').length,alarmCount:scoped.reduce((sum,t)=>sum+Number(t.alarmCount||0),0),avgResolveMinutes:null,trend:[{day:new Date().toISOString().slice(0,10),count:scoped.length}],byType:['OFFLINE','CONNECTOR','POWER','OTHER'].map(faultType=>({faultType,count:scoped.filter(t=>t.faultType===faultType).length}))})
 if(url.endsWith('/simulate-alarm')){if(!b.pileId||!b.description)return fail('请填写设备和描述');const pile=piles.find(p=>same(p.pileId,b.pileId));if(!pile)return fail('演示设备不存在');const tenantId=pile.tenantId;db.alarmCount++;const old=db.faults.find(t=>same(t.pileId,b.pileId)&&same(t.tenantId,tenantId)&&t.faultType===b.faultType&&t.status!=='CLOSED');if(old){persist();return ok({merged:true,ticket:old})}const t={...b,tenantId,id:Date.now(),ticketNo:'GD'+Date.now(),status:'NEW',source:'ALARM',createdAt:now(),logs:[]};db.faults.unshift(t);persist();return ok({merged:false,ticket:t})}
 if(url.endsWith('/assignees'))return ok([user])
 if(!ticket)return fail('工单不存在',404)
 if(method==='post'){const allowed={ASSIGN:['NEW','ASSIGNED'],START:['ASSIGNED'],RESOLVE:['PROCESSING'],CONFIRM:['RESOLVED']};if(!allowed[b.action]?.includes(ticket.status))return fail('当前状态不允许该操作');if(!b.note)return fail('请填写处理说明');if(b.action==='ASSIGN'){if(!b.assigneeId)return fail('请选择处理人');ticket.assigneeId=1;ticket.assigneeName=user.nickName}ticket.status={ASSIGN:'ASSIGNED',START:'PROCESSING',RESOLVE:'RESOLVED',CONFIRM:'CLOSED'}[b.action];ticket.logs.push({id:Date.now(),toStatus:ticket.status,actorName:user.nickName,note:b.note,createdAt:now()});persist()}
 return ok({ticket,logs:ticket.logs,reports:[]})
}
export async function demoAdapter(config){let data;try{data=handle(config)}catch(e){data=fail('模拟接口处理失败：'+e.message)}return {data:clone(data),status:200,statusText:'OK',headers:{},config,request:{responseType:config.responseType}}}
