<style>
	/*每个页面公共css */
	@import 'wxcomponents/vant/common/index.wxss';
	@import 'static/css/common.css';
	@import 'static/css/function.css';
	@import 'static/css/theme-b.css';
</style>

<script>
	export default {
		globalData: {
			// 本地联调使用 project.config.json 中的开发 AppID；正式登录前替换为你自己的 AppID。
			appid: 'wx1ef07afa6a253c30',
			// 本地联调默认使用 localhost；部署到其他机器时请改为该机器的 HTTPS/WSS 地址。
			serverUrl: 'http://localhost:38080/hcp-mp/',
			wsurl: 'ws://localhost:39206/websocket/charge/'
		},
		onLaunch: function() {
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>
