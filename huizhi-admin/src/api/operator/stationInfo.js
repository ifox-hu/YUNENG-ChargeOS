import request from '@/utils/request'

// 查询站点信息列表
export function listStationInfo(query) {
  return request({
    url: '/operator/stationInfo/list',
    method: 'get',
    params: query
  })
}

// 查询站点信息详细
export function getStationInfo(stationId) {
  return request({
    url: '/operator/stationInfo/' + stationId,
    method: 'get'
  })
}

// 新增站点信息
export function addStationInfo(data) {
  return request({
    url: '/operator/stationInfo',
    method: 'post',
    data: data
  })
}

// 修改站点信息
export function updateStationInfo(data) {
  return request({
    url: '/operator/stationInfo',
    method: 'put',
    data: data
  })
}

// 删除站点信息
export function delStationInfo(stationId) {
  return request({
    url: '/operator/stationInfo/' + stationId,
    method: 'delete'
  })
}
