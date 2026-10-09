function request(options) {
  const token = uni.getStorageSync('token') || ''
  const defaultOptions = {
    url: getApp().globalData.serverUrl.replace(/\/$/, '') + '/' + options.url.replace(/^\//, ''),
    header: {
      'content-type': 'application/json',
      'token': token ? `Bearer ${token}` : ''
    },
  	method: options.method || 'GET',
  	data: options.data,
		success: options.success,
		fail: options.fail || (() => uni.showToast({ title: '网络连接失败，请稍后重试', icon: 'none' })),
		complete: options.complete,
		timeout: options.timeout || 12000
  }
	return uni.request(defaultOptions)
}
 
export default request
