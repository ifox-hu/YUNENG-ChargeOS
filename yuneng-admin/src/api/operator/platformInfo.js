import request from '@/utils/request'

// 查询平台信息列表
export function listPlatformInfo(query) {
  return request({
    url: '/operator/platformInfo/list',
    method: 'get',
    params: query
  })
}

// 查询平台信息详细
export function getPlatformInfo(id) {
  return request({
    url: '/operator/platformInfo/' + id,
    method: 'get'
  })
}

// 新增平台信息
export function addPlatformInfo(data) {
  return request({
    url: '/operator/platformInfo',
    method: 'post',
    data: data
  })
}

// 修改平台信息
export function updatePlatformInfo(data) {
  return request({
    url: '/operator/platformInfo',
    method: 'put',
    data: data
  })
}

// 删除平台信息
export function delPlatformInfo(id) {
  return request({
    url: '/operator/platformInfo/' + id,
    method: 'delete'
  })
}
