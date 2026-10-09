import request from '@/utils/request'
// chargingpile/getChargingPileList

export function getChargeTotal(data) {
  return request({
    url: '/operator/total/getChargeTotal',
    method: 'post',
    data: data

  })
}
