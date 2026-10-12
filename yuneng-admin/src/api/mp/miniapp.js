import request from '@/utils/request'

// 查询小程序列表
export function listMiniapp(query) {
  return request({
    url: '/mp/miniapp/list',
    method: 'get',
    params: query
  })
}

// 查询小程序详细
export function getMiniapp(appId) {
  return request({
    url: '/mp/miniapp/' + appId,
    method: 'get'
  })
}

// 新增小程序
export function addMiniapp(data) {
  return request({
    url: '/mp/miniapp',
    method: 'post',
    data: data
  })
}

// 修改小程序
export function updateMiniapp(data) {
  return request({
    url: '/mp/miniapp',
    method: 'put',
    data: data
  })
}

// 删除小程序
export function delMiniapp(appId) {
  return request({
    url: '/mp/miniapp/' + appId,
    method: 'delete'
  })
}
