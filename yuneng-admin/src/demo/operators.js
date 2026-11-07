// Browser-only onboarding/configuration simulation, never provisions real accounts.
const ok = data => ({ code: 200, msg: '浏览器演示操作成功', data })
const fail = msg => ({ code: 500, msg })
const rows = (db, key) => {
  const collection = db.lists[key] || {}
  return collection.rows || collection.data || []
}
const tenants = db => rows(db, '/system/tenant/list')
const defaultRule = tenantId => ({ tenant_id: Number(tenantId), max_charging_hours: 24, whitelist_enabled: 0, version: 0, members: [] })

export function prepareOperatorDemo(db) {
  if (db.operatorDemoVersion !== 1) {
    db.lists['/system/tenant/list'] = { code: 200, data: [{ id: 9999, tenantName: '演示运营商', userName: 'demo', userPhone: '13800000000', userEmail: 'demo@example.com', tenantPackage: 1, tenantTime: '2099-12-31', status: 0 }], total: 1 }
    db.operatorRules = { 9999: defaultRule(9999) }
    db.operatorDemoVersion = 1
  }
  const routes = db.lists['/system/menu/getRouters'].data
  const operate = routes.find(route => route.path === '/operate')
  if (!operate.children.some(route => route.path === 'chargeRule')) {
    operate.children.push({ name: 'OperatorChargeRule', path: 'chargeRule', component: 'operator/chargeRule/index', hidden: false, meta: { title: '充电规则', icon: 'edit', noCache: true }})
  }
}

export function handleDemoOperators(db, url, method, body, query) {
  if (url === '/system/tenantpackage/get-simple-list') return ok([{ id: 1, name: '静态演示运营套餐' }])
  if (url === '/system/tenant/onboard' && method === 'post') {
    const tenant = body.tenant || {}
    if (!/^[1-9]\d*$/.test(String(tenant.id || ''))) return fail('运营商编码无效')
    if (!tenant.tenantName || !tenant.userName || !tenant.userPhone || !tenant.userEmail || !tenant.tenantPackage || !tenant.tenantTime) return fail('请填写完整开户信息')
    if (!/^(?=.*[A-Za-z])(?=.*[0-9])[\x21-\x7e]{8,20}$/.test(body.initialPassword || '')) return fail('初始密码需为8至20位字母、数字组合')
    if (tenants(db).some(row => String(row.id) === String(tenant.id) || row.userName === tenant.userName)) return fail('运营商编码或管理员账号已存在')
    // Whitelist fields explicitly: passwords are never saved to localStorage.
    const { id, tenantName, userName, userPhone, userEmail, tenantPackage, tenantTime, status, remark } = tenant
    tenants(db).unshift({ id: Number(id), tenantName, userName, userPhone, userEmail, tenantPackage, tenantTime, status: Number(status), remark })
    db.operatorRules[id] = defaultRule(id)
    return ok({ tenantId: Number(id), demoOnly: true })
  }
  if (url !== '/operator/chargeRule' && url !== '/operator/chargeRule/member') return null
  const target = Number((method === 'get' ? query : body).targetTenantId || 9999)
  if (!tenants(db).some(row => Number(row.id) === target)) return fail('运营商不存在')
  const rule = db.operatorRules[target] || (db.operatorRules[target] = defaultRule(target))
  if (method === 'get' && url === '/operator/chargeRule') return ok(rule)
  if (Number(body.version) !== rule.version) return fail('配置已更新，请刷新后重试')
  if (method === 'put' && url === '/operator/chargeRule') {
    const hours = Number(body.maxChargingHours)
    if (!Number.isInteger(hours) || hours < 1 || hours > 24 || typeof body.whitelistEnabled !== 'boolean') return fail('充电规则无效')
    rule.max_charging_hours = hours
    rule.whitelist_enabled = body.whitelistEnabled ? 1 : 0
  } else if (method === 'post' && url.endsWith('/member')) {
    const member = rows(db, '/operator/member/list').find(row => String(row.memberId) === String(body.memberId) && Number(row.tenantId) === target)
    if (!member) return fail('会员不存在或不属于该运营商')
    if (rule.members.some(row => String(row.member_id) === String(body.memberId))) return fail('会员已在白名单中')
    rule.members.push({ member_id: member.memberId, user_name: member.userName || member.mobile || String(member.memberId) })
  } else if (method === 'delete' && url.endsWith('/member')) {
    rule.members = rule.members.filter(row => String(row.member_id) !== String(body.memberId))
  } else return fail('不支持的演示操作')
  rule.version++
  return ok(null)
}
