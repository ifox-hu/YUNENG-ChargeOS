import request from '@/utils/request'
const base = '/operator/fault'
export const listFaults = params => request({ url: base + '/list', method: 'get', params })
export const faultStats = () => request({ url: base + '/stats', method: 'get' })
export const getFault = id => request({ url: base + '/' + id, method: 'get' })
export const getAssignees = id => request({ url: base + '/' + id + '/assignees', method: 'get' })
export const simulateAlarm = data => request({ url: base + '/simulate-alarm', method: 'post', data })
export const actOnFault = (id, data) => request({ url: base + '/' + id + '/action', method: 'post', data })

