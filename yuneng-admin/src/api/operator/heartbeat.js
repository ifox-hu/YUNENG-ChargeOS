import request from '@/utils/request'

// 查询充电桩心跳数据列表
export function listHeartbeat(query) {
  return request({
    url: '/operator/heartbeat/list',
    method: 'get',
    params: query
  })
}

// 查询充电桩心跳数据详细
export function getHeartbeat(pileId) {
  return request({
    url: '/operator/heartbeat/' + pileId,
    method: 'get'
  })
}

// 新增充电桩心跳数据
export function addHeartbeat(data) {
  return request({
    url: '/operator/heartbeat',
    method: 'post',
    data: data
  })
}

// 修改充电桩心跳数据
export function updateHeartbeat(data) {
  return request({
    url: '/operator/heartbeat',
    method: 'put',
    data: data
  })
}

// 删除充电桩心跳数据
export function delHeartbeat(pileId) {
  return request({
    url: '/operator/heartbeat/' + pileId,
    method: 'delete'
  })
}
