import request from '@/utils/request'

// 查询省市管理列表
export function listCity(query) {
  return request({
    url: '/operator/city/list',
    method: 'get',
    params: query
  })
}

// 查询省市管理详细
export function getCity(Id) {
  return request({
    url: '/operator/city/' + Id,
    method: 'get'
  })
}

// 新增省市管理
export function addCity(data) {
  return request({
    url: '/operator/city',
    method: 'post',
    data: data
  })
}

// 修改省市管理
export function updateCity(data) {
  return request({
    url: '/operator/city',
    method: 'put',
    data: data
  })
}

// 删除省市管理
export function delCity(Id) {
  return request({
    url: '/operator/city/' + Id,
    method: 'delete'
  })
}
