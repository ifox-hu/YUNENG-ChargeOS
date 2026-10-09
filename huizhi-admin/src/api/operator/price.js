import request from '@/utils/request'

// 查询价格列表
export function listPrice(query) {
  return request({
    url: '/operator/price/list',
    method: 'get',
    params: query
  })
}

// 查询价格详细
export function getPrice(priceId) {
  return request({
    url: '/operator/price/' + priceId,
    method: 'get'
  })
}

// 新增价格
export function addPrice(data) {
  return request({
    url: '/operator/price',
    method: 'post',
    data: data
  })
}

// 修改价格
export function updatePrice(data) {
  return request({
    url: '/operator/price',
    method: 'put',
    data: data
  })
}

// 删除价格
export function delPrice(priceId) {
  return request({
    url: '/operator/price/' + priceId,
    method: 'delete'
  })
}
