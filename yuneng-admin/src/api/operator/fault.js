import request from '@/utils/request'
const base = '/operator/fault'
export const listFaults = params => request({ url: base + '/list', method: 'get', params })
export const faultStats = () => request({ url: base + '/stats', method: 'get' })
export const getFault = id => request({ url: base + '/' + id, method: 'get' })
export const getAssignees = id => request({ url: base + '/' + id + '/assignees', method: 'get' })
export const simulateAlarm = data => request({ url: base + '/simulate-alarm', method: 'post', data })
export const actOnFault = (id, data) => request({ url: base + '/' + id + '/action', method: 'post', data })
export const listAlarmEvents = params => request({ url: base + '/alarms', method: 'get', params })
// This project's interceptor skips its one-second guard when repeatSubmit is false.
// Durable event identity already makes retries safe, including an unknown first response.
export const acceptAlarmEvent = data => request({ url: base + '/alarms', method: 'post', headers: { repeatSubmit: false }, data })
export const replayAlarmEvent = id => request({ url: base + '/alarms/' + id + '/replay', method: 'post' })

