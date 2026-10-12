import request from '@/utils/request'

// 查询用户列表
export function listMember(query) {
  return request({
    url: '/operator/member/list',
    method: 'get',
    params: query
  })
}

// 查询用户详细
export function getMember(memberId) {
  return request({
    url: '/operator/member/' + memberId,
    method: 'get'
  })
}

// 新增用户
export function addMember(data) {
  return request({
    url: '/operator/member',
    method: 'post',
    data: data
  })
}

// 修改用户
export function updateMember(data) {
  return request({
    url: '/operator/member',
    method: 'put',
    data: data
  })
}

// 删除用户
export function delMember(memberId) {
  return request({
    url: '/operator/member/' + memberId,
    method: 'delete'
  })
}
