// Browser-only simulation. No Broker, server-side authentication or real device connection.
const types = ['OFFLINE', 'CONNECTOR', 'POWER', 'OTHER']
const stamp = value => new Date(value).toISOString()
const ok = data => ({ code: 200, msg: '浏览器演示操作成功', data })
const fail = (msg, code = 500) => ({ code, msg })
const nextId = (rows, minimum) => Math.max(minimum, ...rows.map(row => Number(row.id) || 0)) + 1
const devices = db => {
  const collection = db.lists['/operator/pile/list'] || {}
  return collection.rows || collection.data || []
}

function prepare(db, at) {
  if (Array.isArray(db.alarmEvents) && db.alarmEventsVersion === 1) return
  db.alarmEvents = []
  db.alarmEventsVersion = 1
  const piles = devices(db)
  if (!piles.length) return
  const event = (id, name, state, pile, type) => ({
    id, eventId: name, tenantId: 9999, pileId: String(pile.pileId), faultType: type,
    priority: 'NORMAL', description: '浏览器静态告警示例，不连接真实设备或 MQ',
    occurredAt: stamp(at), receivedAt: stamp(at), processedAt: null, ticketId: null,
    publishAttempts: state === 'DEAD' ? 12 : 0, consumeFailures: 0, status: state,
    lastError: state === 'DEAD' ? '静态示例：模拟投递达到上限，可点击重放体验恢复流程' : null,
    readyAt: at + 1500, replayAudit: []
  })
  db.alarmEvents.push(event(5001, 'DEMO-ALARM-PENDING', 'PENDING', piles[1] || piles[0], 'POWER'))
  db.alarmEvents.push(event(5002, 'DEMO-ALARM-DEAD', 'DEAD', piles[0], 'OFFLINE'))
  const ticket = db.faults[0]
  if (ticket) db.alarmEvents.push({ ...event(5003, 'DEMO-ALARM-PROCESSED', 'PROCESSED', { pileId: ticket.pileId }, ticket.faultType), ticketId: ticket.id, processedAt: stamp(at), publishAttempts: 1 })
}

function advance(db, at) {
  db.alarmEvents.filter(event => event.status === 'PENDING' && event.readyAt <= at).forEach(event => {
    let ticket = db.faults.find(row => String(row.pileId) === event.pileId && row.faultType === event.faultType && row.status !== 'CLOSED')
    const merged = !!ticket
    if (!ticket) {
      const pile = devices(db).find(row => String(row.pileId) === event.pileId)
      const id = nextId(db.faults, 1000)
      ticket = { id, ticketNo: 'DEMO-FT-' + id, pileId: event.pileId, pileName: pile ? pile.name : event.pileId, tenantId: 9999,
        faultType: event.faultType, priority: event.priority, source: 'ALARM', status: 'NEW', description: event.description,
        assigneeId: null, assigneeName: '', createdAt: stamp(at), logs: [] }
      db.faults.unshift(ticket)
    }
    ticket.logs.push({ id: nextId(ticket.logs, 0), action: merged ? 'MERGE_ALARM' : 'ALARM', toStatus: ticket.status,
      actorName: '演示管理员', note: '浏览器模拟告警：' + event.description, createdAt: stamp(at) })
    db.alarmCount = (Number(db.alarmCount) || 0) + 1
    Object.assign(event, { status: 'PROCESSED', ticketId: ticket.id, processedAt: stamp(at), publishAttempts: event.publishAttempts + 1, lastError: null })
  })
}

export function handleDemoAlarms(db, url, method, body = {}, query = {}, at = Date.now()) {
  prepare(db, at)
  advance(db, at)
  if (url === '/operator/fault/alarms' && method === 'post') {
    const eventId = String(body.eventId || '').trim(); const pileId = String(body.pileId || '').trim()
    const description = String(body.description || '').trim(); const priority = body.priority || 'NORMAL'
    const occurred = Date.parse(body.occurredAt)
    if (!eventId || eventId.length > 64 || !pileId || pileId.length > 64 || !description || description.length > 1000 ||
        !types.includes(body.faultType) || !['LOW', 'NORMAL', 'HIGH'].includes(priority) || !Number.isFinite(occurred)) return fail('告警参数不合法')
    if (!devices(db).some(row => String(row.pileId) === pileId)) return fail('演示设备不存在，请从充电桩列表复制编号')
    const payload = { eventId, pileId, description, priority, faultType: body.faultType, occurredAt: stamp(occurred) }
    const existing = db.alarmEvents.find(row => row.eventId === eventId)
    if (existing) {
      if (Object.keys(payload).some(key => existing[key] !== payload[key])) return fail('同一事件编号的告警内容不一致', 409)
      return ok({ ...existing, duplicate: true })
    }
    const event = { ...payload, id: nextId(db.alarmEvents, 5000), tenantId: 9999, status: 'PENDING', ticketId: null,
      publishAttempts: 0, consumeFailures: 0, lastError: null, receivedAt: stamp(at), processedAt: null, readyAt: at + 1500, replayAudit: [] }
    db.alarmEvents.unshift(event)
    return ok(event)
  }
  if (url === '/operator/fault/alarms' && method === 'get') {
    const page = Number(query.pageNum || 1); const size = Number(query.pageSize || 10)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 50 ||
        (query.status && !['PENDING', 'PUBLISHING', 'SENT', 'PROCESSED', 'DEAD'].includes(query.status))) return fail('查询参数不合法')
    const rows = db.alarmEvents.filter(row => (!query.pileId || row.pileId === query.pileId) && (!query.status || row.status === query.status)).sort((a, b) => b.id - a.id)
    return ok({ records: rows.slice((page - 1) * size, page * size), total: rows.length })
  }
  const match = url.match(/^\/operator\/fault\/alarms\/(\d+)(\/replay)?$/)
  const event = match && db.alarmEvents.find(row => row.id === Number(match[1]))
  if (!event) return fail('演示告警不存在')
  if (match[2] && method === 'post') {
    if (event.status !== 'DEAD') return fail('仅失败终止事件允许重放', 409)
    Object.assign(event, { status: 'PENDING', publishAttempts: 0, consumeFailures: 0, lastError: null, readyAt: at + 1500 })
    event.replayAudit.push({ action: 'REPLAY', actorName: '演示管理员', createdAt: stamp(at) })
    return ok(event)
  }
  return method === 'get' && !match[2] ? ok(event) : fail('不支持的演示操作')
}
