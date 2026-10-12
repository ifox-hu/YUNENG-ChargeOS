<template>
	<view class='container b-settings'>
		<view class='b-settings-intro'><text class='b-heading'>账号设置</text><text class='b-description'>管理当前登录状态</text></view>
		<navbar title='设置'></navbar>
		<!--<van-cell-group class='cells f-db'>
			<van-cell title='隐私协议' is-link></van-cell>
			<van-cell title='用户政策' is-link></van-cell>
		</van-cell-group>-->
		<van-button type='default' class='logout f-db' v-on:click='logout'>退出登录</van-button>
	</view>
</template>

<style scoped>
	.container{
		padding-top: 160rpx;
	}
	.cells{
		margin-top: 20rpx;
	}
	.logout{
		width: calc(100% - 60rpx);
		margin: 40rpx auto 0 auto;
	}
	.logout /deep/ .van-button{
		width: 100%;
	}
</style>

<script setup>
	import navbar from '../../components/navbar/index.vue'
	const clearSession = () => {
		;['token', 'user', 'phone', 'redirecturl'].forEach(key => uni.removeStorageSync(key))
		uni.reLaunch({ url: '/pages/user/index' })
	}
	
	const logout = () => {
		uni.showModal({
			title: '确定退出?',
			showCancel: true,
			success: (res) => {
				if(res.confirm) {
					uni.request({
						url: getApp().globalData.serverUrl.replace(/\/$/, '') + '/v1/auth/account/logout',
						method: 'POST', timeout: 8000,
						header: { token: 'Bearer ' + uni.getStorageSync('token') },
						complete: clearSession
					})
				}
			}
		})	
	}
</script>
