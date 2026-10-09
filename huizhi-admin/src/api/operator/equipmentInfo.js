import request from '@/utils/request'

// 查询设备列表列表
export function listEquipmentInfo(query) {
  return request({
    url: '/operator/equipmentInfo/list',
    method: 'get',
    params: query
  })
}

// 查询设备列表详细
export function getEquipmentInfo(equipmentID) {
  return request({
    url: '/operator/equipmentInfo/' + equipmentID,
    method: 'get'
  })
}

// 新增设备列表
export function addEquipmentInfo(data) {
  return request({
    url: '/operator/equipmentInfo',
    method: 'post',
    data: data
  })
}

// 修改设备列表
export function updateEquipmentInfo(data) {
  return request({
    url: '/operator/equipmentInfo',
    method: 'put',
    data: data
  })
}

// 删除设备列表
export function delEquipmentInfo(equipmentID) {
  return request({
    url: '/operator/equipmentInfo/' + equipmentID,
    method: 'delete'
  })
}
