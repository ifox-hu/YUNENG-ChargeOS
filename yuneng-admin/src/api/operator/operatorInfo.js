import request from '@/utils/request'

// 查询运营商信息列表
export function listOperatorInfo(query) {
  return request({
    url: '/operator/operatorInfo/list',
    method: 'get',
    params: query
  })
}

// 查询运营商信息详细
export function getOperatorInfo(operatorId) {
  return request({
    url: '/operator/operatorInfo/' + operatorId,
    method: 'get'
  })
}

// 新增运营商信息
export function addOperatorInfo(data) {
  return request({
    url: '/operator/operatorInfo',
    method: 'post',
    data: data
  })
}

// 修改运营商信息
export function updateOperatorInfo(data) {
  return request({
    url: '/operator/operatorInfo',
    method: 'put',
    data: data
  })
}

// 删除运营商信息
export function delOperatorInfo(operatorId) {
  return request({
    url: '/operator/operatorInfo/' + operatorId,
    method: 'delete'
  })
}
