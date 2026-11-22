import request from '@/utils/request'

export function getOperationOverview(params) {
  return request({
    url: '/operator/overview',
    method: 'get',
    params
  })
}

export function getOperations(resource, params) {
  return request({
    url: '/operator/operations/' + resource,
    method: 'get',
    params
  })
}

export function saveOperation(resource, data) {
  return request({
    url: '/operator/operations/' + resource,
    method: 'post',
    data
  })
}

export function operationKey() {
  return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
