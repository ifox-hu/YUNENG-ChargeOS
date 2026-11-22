import request from '@/utils/request'

// 查询站点列表
export function listStation(query) {
  return request({
    url: '/operator/station/list',
    method: 'get',
    params: query
  })
}

// 查询站点详细
export function getStation(stationId) {
  return request({
    url: '/operator/station/' + stationId,
    method: 'get'
  })
}

function devicesUrl(stationId) {
  return '/operator/station/' + encodeURIComponent(stationId) + '/devices'
}

export function getStationDevices(stationId, tenantId) {
  return request({
    url: devicesUrl(stationId),
    method: 'get',
    params: { tenantId }
  })
}

export function getStationDeviceRates(stationId) {
  return request({ url: devicesUrl(stationId) + '/rates', method: 'get' })
}

export function addStationDevice(stationId, data) {
  return request({ url: devicesUrl(stationId), method: 'post', data })
}

export function setStationDeviceSimulation(pileId, online) {
  const action = online ? 'start' : 'stop'
  return request({ url: '/simulator/evcs/sim/v1/station-device/' + action, method: 'post', data: { pileId } })
}

// 新增站点
export function addStation(data) {
  return request({
    url: '/operator/station',
    method: 'post',
    data: data
  })
}

// 修改站点
export function updateStation(data) {
  return request({
    url: '/operator/station',
    method: 'put',
    data: data
  })
}

// 删除站点
export function delStation(stationId) {
  return request({
    url: '/operator/station/' + stationId,
    method: 'delete'
  })
}
