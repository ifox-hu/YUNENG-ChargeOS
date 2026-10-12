import request from '@/utils/request'

// 查询对象存储列表
export function listOssConfig(query) {
  return request({
    url: '/file/ossConfig/list',
    method: 'get',
    params: query
  })
}

// 查询对象存储详细
export function getOssConfig(id) {
  return request({
    url: '/file/ossConfig/' + id,
    method: 'get'
  })
}

// 新增对象存储
export function addOssConfig(data) {
  return request({
    url: '/file/ossConfig',
    method: 'post',
    data: data
  })
}

// 修改对象存储
export function updateOssConfig(data) {
  return request({
    url: '/file/ossConfig',
    method: 'put',
    data: data
  })
}

// 删除对象存储
export function delOssConfig(id) {
  return request({
    url: '/file/ossConfig/' + id,
    method: 'delete'
  })
}
