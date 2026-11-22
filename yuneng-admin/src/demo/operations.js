// 浏览器本地运营演示。金额以整数分计算，不代表真实支付或设备收入。
const ok = data => ({ code: 200, data })
const fail = msg => ({ code: 500, msg })
const rows = (db, path) => { const list = db.lists[path] || {}; return list.rows || list.data || [] }
const cents = value => Math.round(Number(value || 0) * 100)
const yuan = value => Number((value / 100).toFixed(2))
const now = () => new Date().toLocaleString('sv-SE')
const tenant = query => Number(query.targetTenantId || 9999)
const own = (row, target) => Number(row.tenant_id) === target
function page(records, query) { const size = Math.max(1, Math.min(100, Number(query.size) || 10)); const start = (Math.max(1, Number(query.page) || 1) - 1) * size; return { records: records.slice(start, start + size), total: records.length } }
function required(value, label) { if (!value || String(value).length > 255) throw new Error(label + '不能为空或过长') }
function amount(value) { if (!Number.isFinite(Number(value)) || Number(value) < 0 || Math.abs(Number(value) * 100 - cents(value)) > 0.000001) throw new Error('金额格式无效'); return cents(value) }
function inDate(coupon) { return Number(new Date(coupon.valid_from.replace(' ', 'T'))) <= Date.now() && Number(new Date(coupon.valid_to.replace(' ', 'T'))) >= Date.now() }
function orderView(db, order) {
  const payment = db.operations.payments.find(row => row.order_id === order.orderId)
  let exception = null
  if (order.orderState === '1' && order.chargeStatus === '9001' && (String(order.stopReason).includes('待确认') || Date.now() - new Date(order.startTime.replace(' ', 'T')) > 1800000)) exception = 'START_UNCERTAIN'
  else if (order.orderState === '1' && order.chargeStatus === '9002' && Date.now() - new Date(order.startTime.replace(' ', 'T')) > 86400000) exception = 'LONG_RUNNING'
  else if (order.orderState === '6') exception = 'SETTLEMENT_TIMEOUT'
  else if (['3', '4', '5', '7'].includes(order.orderState) && (!order.ordergold || cents(order.ordergold) !== cents(order.chargeFee) + cents(order.serviceFee))) exception = 'AMOUNT_MISMATCH'
  else if (['3', '4', '5', '7'].includes(order.orderState) && (!order.endTime || !order.realEndTime)) exception = 'INCOMPLETE_END'
  return { ...order, order_id: order.orderId, order_number: order.orderNumber, user_id: order.userId, order_state: order.orderState, charge_status: order.chargeStatus, station_name: order.stationName, pile_id: order.pileId, start_time: order.startTime, end_time: order.endTime, ordergold: order.ordergold, stop_reason: order.stopReason, consume_power: order.consumePower, exception_type: exception, payment_id: payment && payment.id, payment_status: payment && payment.status, paid_amount: payment && payment.paid_amount, refunded_amount: payment && payment.refunded_amount, discount_amount: payment && payment.discount_amount }
}

export function prepareOperationsDemo(db) {
  const routes = db.lists['/system/menu/getRouters'].data
  // 清除旧浏览器缓存中的独立菜单，功能由原有订单、余额、会员页面承载。
  for (let i = routes.length - 1; i >= 0; i--) { if (routes[i].path === '/operations') routes.splice(i, 1) }
  if (db.operations) { db.operations.ledgers = db.operations.ledgers || []; return }
  db.operations = { payments: [], refunds: [], splits: [], batches: [], notes: [], logs: [], templates: [], coupons: [], accounts: {}, rules: {}, ledgers: [], nextId: 10000 }
  const op = db.operations
  rows(db, '/operator/member/list').forEach(member => { op.accounts[member.memberId] = 100000 })
  // 明确标记新演示记录，不修改既有历史订单的付款状态。
  const list = db.lists['/operator/order/list']
  const records = rows(db, '/operator/order/list')
  const pile = rows(db, '/operator/pile/list').find(row => String(row.pileId) === '202312121') || rows(db, '/operator/pile/list')[0]
  const member = rows(db, '/operator/member/list')[0]
  for (let i = 0; i < 14; i++) {
    const date = new Date(); date.setDate(date.getDate() - i % 7); date.setHours(10 + i % 9, 15, 0, 0)
    const time = date.toLocaleString('sv-SE')
    records.unshift({ orderId: 'LOCAL_DEMO_' + i, orderNumber: 'LOCAL_DEMO_' + i, userId: member.memberId, tenantId: 9999, pileId: pile.pileId, stationId: pile.stationId, stationName: '本地模拟体验站', orderState: i === 13 ? '1' : '5', chargeStatus: i === 13 ? '9001' : '9003', ordergold: i === 13 ? '0.00' : (20 + i).toFixed(2), chargeFee: i === 13 ? 0 : 17 + i, serviceFee: i === 13 ? 0 : 3, consumePower: i === 13 ? 0 : 8 + i / 2, createTime: time, startTime: time, endTime: i === 13 ? '' : time, realEndTime: i === 13 ? null : time, deviceType: 4, stopReason: i === 13 ? '设备启动结果待确认' : '本地模拟结算', logList: [] })
  }
  list.data = records
  if (list.rows) list.rows = records
  list.total = records.length
}

export function prepareOperationsSamples(db) {
  const op = db.operations
  if (op.samplesVersion === 1) return
  const targetTenantId = 9999
  const orders = rows(db, '/operator/order/list').filter(row => Number(row.tenantId) === targetTenantId)
  const example = orders.find(row => row.orderId === 'LOCAL_DEMO_0')
  if (example && Object.prototype.hasOwnProperty.call(op.accounts, example.userId)) {
    const stamp = days => new Date(Date.now() + days * 86400000).toLocaleString('sv-SE')
    const run = (action, values) => handleOperations(db, '/operator/operations/' + action, 'post', { targetTenantId, ...values }, {})
    const validFrom = stamp(-7), validTo = stamp(30)
    for (const [name, thresholdAmount, discountAmount] of [['周末充电券（满20减3）', 20, 3], ['新会员充电券（满10减2）', 10, 2]]) {
      if (!op.templates.some(row => own(row, targetTenantId) && row.name === name)) {
        const result = run('coupon', { name, thresholdAmount, discountAmount, totalCount: 100, validFrom, validTo })
        const template = op.templates.find(row => own(row, targetTenantId) && row.name === name)
        if (result.code === 200 && template) run('coupon/issue', { templateId: template.id, memberId: example.userId, requestId: 'sample-coupon-' + template.id })
      }
    }
    const coupon = op.coupons.find(row => own(row, targetTenantId) && row.name === '周末充电券（满20减3）' && row.status === 'UNUSED')
    const usedOrders = ['LOCAL_DEMO_0', 'LOCAL_DEMO_1', 'LOCAL_DEMO_2']
    let seeded = false
    usedOrders.forEach((orderId, index) => {
      if (op.payments.some(row => own(row, targetTenantId) && row.order_id === orderId)) return
      const result = run('pay', { orderId, requestId: 'sample-payment-' + index, couponId: index === 0 && coupon ? coupon.id : undefined })
      if (result.code !== 200) return
      seeded = true
      run('split', { orderId })
      if (index === 1) run('refund', { orderId, requestId: 'sample-refund-1', amount: 3, reason: '演示：部分充电费用退回' })
    })
    if (seeded) run('reconcile', { businessDay: stamp(0).slice(0, 10) })
  }
  op.samplesVersion = 1
}

export function handleOperations(db, url, method, body, query) {
  if (!url.startsWith('/operator/operations/')) return null
  const op = db.operations; const target = tenant(method === 'get' ? query : body)
  const orders = rows(db, '/operator/order/list').filter(row => Number(row.tenantId) === target)
  const payments = op.payments.filter(row => own(row, target))
  const templates = op.templates.filter(row => own(row, target))
  const resource = url.slice('/operator/operations/'.length)
  const rule = op.rules[target] || { platform_rate: 10, version: 0 }
  if (method === 'get') {
    if (resource === 'overview') {
      const selected = orders.filter(row => { const date = String(row.realEndTime || row.createTime || '').slice(0, 10); return (!query.from || date >= query.from) && (!query.to || date <= query.to) && (!query.stationId || Number(row.stationId || (rows(db, '/operator/pile/list').find(pile => pile.pileId === row.pileId) || {}).stationId) === Number(query.stationId)) })
      const summary = { gross: 0, power: 0, orders: selected.length, net: 0, discount: 0, refunded: 0 }; const trend = {}; const ranking = {}
      selected.forEach(order => {
        const date = String(order.realEndTime || order.createTime).slice(0, 10)
        const payment = payments.find(payment => payment.order_id === order.orderId)
        const net = payment && payment.status === 'PAID' ? cents(payment.paid_amount) - cents(payment.refunded_amount) : 0
        if (['3', '4', '5', '7'].includes(order.orderState)) { summary.gross += cents(order.ordergold); summary.power += Number(order.consumePower || 0) }
        summary.net += net; summary.discount += payment ? cents(payment.discount_amount) : 0; summary.refunded += payment ? cents(payment.refunded_amount) : 0
        if (!trend[date]) trend[date] = { day: date, orders: 0, power: 0, net: 0 }
        trend[date].orders++; trend[date].power += Number(order.consumePower || 0); trend[date].net += net
        const station = order.stationName || '未归属站点'
        if (!ranking[station]) ranking[station] = { name: station, orders: 0, net: 0 }
        ranking[station].orders++; ranking[station].net += net
      })
      ;['gross', 'net', 'discount', 'refunded'].forEach(key => { summary[key] = yuan(summary[key]) })
      const devices = {}
      rows(db, '/operator/pile/list').filter(row => Number(row.tenantId) === target && (!query.stationId || Number(row.stationId) === Number(query.stationId))).forEach(row => { devices[row.runningStatus] = (devices[row.runningStatus] || 0) + 1 })
      return ok({ tenantId: target, summary, trend: Object.values(trend).sort((a, b) => a.day.localeCompare(b.day)).map(row => ({ ...row, net: yuan(row.net) })), ranking: Object.values(ranking).sort((a, b) => b.net - a.net).slice(0, 8).map(row => ({ ...row, net: yuan(row.net) })), devices: Object.entries(devices).map(([status, count]) => ({ status, count })), stations: rows(db, '/operator/station/list').filter(row => Number(row.tenantId) === target).map(row => ({ station_id: row.stationId, station_name: row.stationName })), pending: { exceptions: orders.filter(row => orderView(db, row).exception_type).length, faults: target === 9999 ? db.faults.filter(row => row.status !== 'CLOSED').length : 0, points: 0 }, basis: '浏览器模拟数据；净收来自本页本地付款减退款，历史记录不自动计为已收款' })
    }
    if (resource === 'orders' || resource === 'exceptions') return ok(page(orders.map(row => orderView(db, row)).filter(row => (!['true', true].includes(query.exceptions) || row.exception_type) && (!query.keyword || (row.order_number + row.pile_id).includes(query.keyword))), query))
    if (resource.startsWith('orders/')) { const order = orders.find(row => row.orderId === decodeURIComponent(resource.slice(7))); if (!order) return fail('订单不存在'); return ok({ order: orderView(db, order), logs: (order.logList || []).map(row => ({ ...row, create_time: row.createTime, log_content: row.logContent })), handling: op.logs.filter(row => own(row, target) && row.order_id === order.orderId) }) }
    if (resource === 'finance') return ok({ ...page(payments.slice().reverse(), query), refunds: op.refunds.filter(row => own(row, target)).slice(-100).reverse(), splits: op.splits.filter(row => own(row, target)).slice(-100).reverse(), batches: op.batches.filter(row => own(row, target)).slice(-30).reverse(), notes: op.notes.filter(row => own(row, target)).slice(-100).reverse(), rule })
    if (resource === 'coupons') return ok({ ...page(templates.slice().reverse(), query), coupons: op.coupons.filter(row => own(row, target) && (!query.memberId || Number(row.member_id) === Number(query.memberId))).slice(-100).reverse().map(row => ({ ...row, in_date: inDate(row) ? 1 : 0 })) })
    return fail('演示查询不存在')
  }
  const id = () => ++op.nextId
  const order = orders.find(row => row.orderId === body.orderId)
  const payment = payments.find(row => row.order_id === body.orderId)
  const log = action => op.logs.push({ id: id(), tenant_id: target, order_id: body.orderId, action, note: body.reason, actor_id: 1, created_at: now() })
  if (resource === 'coupon') {
    if (body.templateId) { const template = templates.find(row => row.id === Number(body.templateId)); if (!template) return fail('模板不存在'); template.enabled = body.enabled ? 1 : 0; return ok(null) }
    required(body.name, '名称'); const threshold = amount(body.thresholdAmount); const discount = amount(body.discountAmount)
    if (!discount || discount > threshold || !Number.isInteger(body.totalCount) || body.totalCount < 1 || body.totalCount > 100000 || !(new Date(body.validFrom.replace(' ', 'T')) < new Date(body.validTo.replace(' ', 'T')))) return fail('券金额、额度或有效期不合法')
    op.templates.push({ id: id(), tenant_id: target, name: body.name, threshold_amount: yuan(threshold), discount_amount: yuan(discount), valid_from: body.validFrom, valid_to: body.validTo, total_count: body.totalCount, issued_count: 0, enabled: 1 }); return ok(null)
  }
  if (resource === 'coupon/issue') {
    required(body.requestId, '请求号')
    const old = op.coupons.find(row => own(row, target) && row.request_id === body.requestId)
    if (old) return old.member_id === body.memberId && old.template_id === body.templateId ? ok(old) : fail('同一请求号内容不一致')
    const template = templates.find(row => row.id === Number(body.templateId))
    if (!rows(db, '/operator/member/list').some(row => Number(row.tenantId) === target && Number(row.memberId) === Number(body.memberId))) return fail('会员不存在或不属于当前运营商')
    if (!template || !template.enabled || template.issued_count >= template.total_count || new Date(template.valid_to.replace(' ', 'T')) <= new Date()) return fail('券已停发、过期或额度用尽')
    const coupon = { ...template, id: id(), template_id: template.id, member_id: Number(body.memberId), request_id: body.requestId, status: 'UNUSED', used_order_id: null }
    template.issued_count++; op.coupons.push(coupon); return ok(coupon)
  }
  if (resource === 'split/rule') {
    const rate = amount(body.platformRate); if (rate > 10000 || body.version !== rule.version) return fail('比例无效或配置已更新')
    op.rules[target] = { platform_rate: yuan(rate), version: rule.version + 1 }; return ok(null)
  }
  if (resource === 'reconcile/note') { if (!op.batches.some(row => own(row, target) && row.id === body.batchId)) return fail('批次不存在'); required(body.reason, '处理说明'); op.notes.push({ id: id(), tenant_id: target, batch_id: body.batchId, note: body.reason, actor_id: 1 }); return ok(null) }
  if (resource === 'reconcile') {
    required(body.businessDay, '业务日')
    const list = payments.filter(row => row.created_at.slice(0, 10) === body.businessDay)
    const details = list.map(row => {
      const ledger = op.ledgers.filter(item => item.payment_id === row.id)
      const debit = -ledger.filter(item => item.type === 'PAY').reduce((sum, item) => sum + item.amount, 0)
      const credit = ledger.filter(item => item.type === 'REFUND').reduce((sum, item) => sum + item.amount, 0)
      const refunded = op.refunds.filter(item => item.payment_id === row.id).reduce((sum, item) => sum + cents(item.amount), 0)
      const splits = op.splits.filter(item => item.payment_id === row.id)
      const split = splits.length ? splits.reduce((sum, item) => sum + cents(item.platform_amount) + cents(item.station_amount), 0) : null
      return { orderId: row.order_id, paid: row.paid_amount, walletDebit: yuan(debit), refunded: row.refunded_amount, walletCredit: yuan(credit), split: split === null ? null : yuan(split), matched: debit === cents(row.paid_amount) && credit === cents(row.refunded_amount) && refunded === credit && (split === null || split === debit - credit) }
    })
    const batch = { id: id(), tenant_id: target, business_day: body.businessDay, checked_count: list.length, difference_count: details.filter(row => !row.matched).length, excluded_count: orders.filter(row => !payments.some(payment => payment.order_id === row.orderId) && String(row.realEndTime).slice(0, 10) === body.businessDay).length, details: JSON.stringify(details), actor_id: 1, created_at: now() }; op.batches.push(batch); return ok(batch)
  }
  if (!order) return fail('订单不存在或不属于当前运营商')
  if (resource === 'pay') {
    required(body.requestId, '请求号'); if (payment) return Number(payment.coupon_id || 0) === Number(body.couponId || 0) ? ok(payment) : fail('订单已付款，请勿更换优惠券重复提交')
    if (payments.some(row => row.request_id === body.requestId)) return fail('请求号已用于其他订单')
    if (!['3', '5', '7'].includes(order.orderState) || order.chargeStatus !== '9003' || Number(order.deviceType) !== 4) return fail('仅支持已完成本地模拟订单')
    const gross = amount(order.ordergold)
    if (gross <= 0 || gross !== amount(order.chargeFee) + amount(order.serviceFee)) return fail('订单费用异常')
    const coupon = body.couponId ? op.coupons.find(row => row.id === Number(body.couponId) && own(row, target) && Number(row.member_id) === Number(order.userId) && row.status === 'UNUSED' && inDate(row)) : null
    if (body.couponId && (!coupon || gross < cents(coupon.threshold_amount))) return fail('优惠券不可用或未达到门槛')
    const discount = coupon ? Math.min(gross, cents(coupon.discount_amount)) : 0; const paid = gross - discount
    if ((op.accounts[order.userId] || 0) < paid) return fail('模拟余额不足')
    const row = { id: id(), tenant_id: target, order_id: order.orderId, order_number: order.orderNumber, member_id: order.userId, request_id: body.requestId, gross_amount: yuan(gross), discount_amount: yuan(discount), paid_amount: yuan(paid), refunded_amount: 0, coupon_id: coupon ? coupon.id : null, status: 'PAID', created_at: now() }
    op.accounts[order.userId] -= paid; if (coupon) { coupon.status = 'USED'; coupon.used_order_id = order.orderId }
    if (paid) op.ledgers.push({ payment_id: row.id, type: 'PAY', amount: -paid, member_id: order.userId })
    op.payments.push(row); return ok(row)
  }
  if (resource === 'exception/action') { required(body.reason, '处理说明'); if (!['NOTE', 'RECHECK', 'CANCEL'].includes(body.action)) return fail('动作不合法'); if (body.action === 'CANCEL') { if (order.orderState === '1' || order.orderState !== '2' || order.chargeStatus !== '9001' || String(order.stopReason).includes('待确认') || Number(order.consumePower) || Number(order.ordergold) || payment) return fail('订单有费用、电量或结果不确定，不能取消'); order.orderState = '2' } log(body.action); return ok(null) }
  if (!payment) return fail('未纳入本地收款，不能退款或分账')
  const restore = () => { const coupon = op.coupons.find(row => row.id === payment.coupon_id && row.used_order_id === order.orderId); if (coupon) { coupon.status = 'UNUSED'; coupon.used_order_id = null } }
  if (resource === 'void') { required(body.reason, '撤销原因'); if (cents(payment.paid_amount) !== 0) return fail('正额订单请使用退款'); if (payment.status === 'CANCELLED') return ok(null); restore(); payment.status = 'CANCELLED'; log('VOID_COUPON'); return ok(null) }
  if (resource === 'split') {
    if (op.splits.some(row => row.payment_id === payment.id && !row.refund_id)) return ok(null)
    const net = cents(payment.paid_amount) - cents(payment.refunded_amount); if (net <= 0 || payment.status !== 'PAID') return fail('无可分账净收')
    const platform = Math.round(net * Number(rule.platform_rate) / 100)
    op.splits.push({ id: id(), tenant_id: target, payment_id: payment.id, order_id: order.orderId, refund_id: 0, platform_rate: rule.platform_rate, platform_amount: yuan(platform), station_amount: yuan(net - platform), created_at: now() }); return ok(null)
  }
  if (resource === 'refund') {
    required(body.requestId, '请求号'); required(body.reason, '退款原因'); const value = amount(body.amount)
    const old = op.refunds.find(row => own(row, target) && row.request_id === body.requestId)
    if (old) return old.order_id === body.orderId && cents(old.amount) === value && old.reason === body.reason ? ok(old) : fail('同一请求号内容不一致')
    const total = cents(payment.refunded_amount) + value
    if (value <= 0 || total > cents(payment.paid_amount) || payment.status !== 'PAID') return fail('退款金额超过剩余实付')
    const refund = { id: id(), tenant_id: target, payment_id: payment.id, order_id: order.orderId, request_id: body.requestId, amount: yuan(value), reason: body.reason, actor_id: 1, created_at: now() }
    op.refunds.push(refund); op.accounts[order.userId] += value; payment.refunded_amount = yuan(total)
    op.ledgers.push({ payment_id: payment.id, refund_id: refund.id, type: 'REFUND', amount: value, member_id: order.userId })
    if (total === cents(payment.paid_amount)) { order.orderState = '4'; restore() }
    const first = op.splits.find(row => row.payment_id === payment.id && !row.refund_id)
    if (first) {
      const records = op.splits.filter(row => row.payment_id === payment.id)
      const net = cents(payment.paid_amount) - total; const platform = Math.round(net * first.platform_rate / 100)
      op.splits.push({ id: id(), tenant_id: target, payment_id: payment.id, order_id: order.orderId, refund_id: refund.id, platform_rate: first.platform_rate, platform_amount: yuan(platform - records.reduce((sum, row) => sum + cents(row.platform_amount), 0)), station_amount: yuan(net - platform - records.reduce((sum, row) => sum + cents(row.station_amount), 0)), created_at: now() })
    }
    return ok(refund)
  }
  return fail('操作未接入')
}
