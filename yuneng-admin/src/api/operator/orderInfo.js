import request from '@/utils/request'

// 查询充电站充电订单信息列表
export function listOrderInfo(query) {
  return request({
    url: '/operator/orderInfo/list',
    method: 'get',
    params: query
  })
}

// 查询充电站充电订单信息详细
export function getOrderInfo(orderNo) {
  return request({
    url: '/operator/orderInfo/' + orderNo,
    method: 'get'
  })
}

// 新增充电站充电订单信息
export function addOrderInfo(data) {
  return request({
    url: '/operator/orderInfo',
    method: 'post',
    data: data
  })
}

// 修改充电站充电订单信息
export function updateOrderInfo(data) {
  return request({
    url: '/operator/orderInfo',
    method: 'put',
    data: data
  })
}

// 删除充电站充电订单信息
export function delOrderInfo(orderNo) {
  return request({
    url: '/operator/orderInfo/' + orderNo,
    method: 'delete'
  })
}
