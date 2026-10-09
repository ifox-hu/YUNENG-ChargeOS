import request from '@/utils/request'

// 查询充电订单列表
export function listOrder(query) {
  return request({
    url: '/operator/order/list',
    method: 'get',
    params: query
  })
}

// 查询充电订单详细
export function getOrder(orderId) {
  return request({
    url: '/operator/order/' + orderId,
    method: 'get'
  })
}

// 查询充电订单详细
export function getOrderByOrderNumber(orderId) {
  return request({
    url: '/operator/order/getOrderByOrderNumber/' + orderId,
    method: 'get'
  })
}

// 新增充电订单
export function addOrder(data) {
  return request({
    url: '/operator/order',
    method: 'post',
    data: data
  })
}

// 修改充电订单
export function updateOrder(data) {
  return request({
    url: '/operator/order',
    method: 'put',
    data: data
  })
}

// 删除充电订单
export function delOrder(orderId) {
  return request({
    url: '/operator/order/' + orderId,
    method: 'delete'
  })
}


