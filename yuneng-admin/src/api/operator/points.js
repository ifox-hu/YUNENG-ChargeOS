import request from '@/utils/request'

export function listPointsEvents(params) {
  return request({
    url: '/operator/points/events',
    method: 'get',
    params
  })
}

export function retryPointsEvent(eventId) {
  return request({
    url: '/operator/points/events/' + encodeURIComponent(eventId) + '/retry',
    method: 'post'
  })
}
