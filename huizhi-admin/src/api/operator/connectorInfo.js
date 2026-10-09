import request from '@/utils/request'

// 查询接口信息列表
export function listConnectorInfo(query) {
  return request({
    url: '/operator/connectorInfo/list',
    method: 'get',
    params: query
  })
}

// 查询接口信息详细
export function getConnectorInfo(connectorId) {
  return request({
    url: '/operator/connectorInfo/' + connectorId,
    method: 'get'
  })
}

// 新增接口信息
export function addConnectorInfo(data) {
  return request({
    url: '/operator/connectorInfo',
    method: 'post',
    data: data
  })
}

// 修改接口信息
export function updateConnectorInfo(data) {
  return request({
    url: '/operator/connectorInfo',
    method: 'put',
    data: data
  })
}

// 删除接口信息
export function delConnectorInfo(connectorId) {
  return request({
    url: '/operator/connectorInfo/' + connectorId,
    method: 'delete'
  })
}
