import request from '@/utils/request'

// 查询收费规则列表
export function listRule(query) {
  return request({
    url: '/operator/rule/list',
    method: 'get',
    params: query
  })
}

// 查询收费规则详细
export function getRule(id) {
  return request({
    url: '/operator/rule/' + id,
    method: 'get'
  })
}

// 新增收费规则
export function addRule(data) {
  return request({
    url: '/operator/rule',
    method: 'post',
    data: data
  })
}

// 修改收费规则
export function updateRule(data) {
  return request({
    url: '/operator/rule',
    method: 'put',
    data: data
  })
}

// 删除收费规则
export function deleteRule(data) {
  return request({
    url: '/operator/rule/deleteRule',
    method: 'delete',
    params: data
  })
}

export function getRulePriceList(data) {
  return request({
    url: '/operator/rule/getRulePriceList',
    method: 'get',
    params: data
  })
}

export function copyRule(data){
  return request({
    url: '/operator/rule/copyRule',
    method: 'get',
    params: data
  })
}
