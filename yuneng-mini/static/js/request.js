function request(options) {
  const token = uni.getStorageSync('token') || ''
  const defaultOptions = {
    url: getApp().globalData.serverUrl + options.url,
    header: {
      'content-type': 'application/json',
      'token': `Bearer ${uni.getStorageSync('token')}`
    },
  	method: options.method || 'GET',
  	data: options.data,
  	success: options.success
  }
	uni.request(defaultOptions)
}
 
export default request
