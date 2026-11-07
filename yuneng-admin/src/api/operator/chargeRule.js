import request from '@/utils/request'

export const getRule = targetTenantId => request({ url: '/operator/chargeRule', params: { targetTenantId } })
export const saveRule = data => request({ url: '/operator/chargeRule', method: 'put', data })
export const addMember = data => request({ url: '/operator/chargeRule/member', method: 'post', data })
export const removeMember = data => request({ url: '/operator/chargeRule/member', method: 'delete', data })
