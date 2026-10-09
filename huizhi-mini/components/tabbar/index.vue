<template>
	<view class='tabbar'>
		<view class='tabbar-main'>
			<view class='tabbar-item' @click='go("/pages/index/index")'>
				<image :src='active == 0 ? home.active : home.default' class='tabbar-icon' mode='aspectFit' />
				<text class='tabbar-label' :class='active == 0 ? "text-active" : "text-default"'>首页</text>
			</view>
			<view class='tabbar-item' @click='scan'>
				<view class='scan'>
					<image class='scan-pic' src='/static/image/tab-scan-b.png' mode='aspectFit' />
					<text class='scan-label'>扫码充电</text>
				</view>
			</view>
			<view class='tabbar-item' @click='go("/pages/user/index")'>
				<image :src='active == 1 ? user.active : user.default' class='tabbar-icon' mode='aspectFit' />
				<text class='tabbar-label' :class='active == 1 ? "text-active" : "text-default"'>我的</text>
			</view>
		</view>
	</view>
</template>

<style scoped>
	.tabbar{
		background: white;
		border-top: 1rpx solid #e4ece7;
		position: fixed;
		left: 0;
		bottom: 0;
		z-index: 2;
		width: 100%;
		height: 124rpx;
		padding-bottom: env(safe-area-inset-bottom);
		font-size: 24rpx;
	}
	.tabbar-main { display: flex; align-items: center; height: 124rpx; }
	.tabbar-item { flex: 1; min-width: 0; height: 124rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; }
	.tabbar-label { display: block; line-height: 34rpx; margin-top: 6rpx; }
	.tabbar-icon{
		width: 44rpx;
		height: 42rpx;
	}
	.text-active{
		color: #008773;
	}
	.text-default{
		color: #666;
	}
	.scan{
		background: linear-gradient(120deg, #16b99c, #008773);
		width: 160rpx;
		height: 104rpx;
		border-radius: 28rpx;
		margin: -16rpx auto 0 auto;
		border: 8rpx solid #f3f7f5;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: content-box;
	}
	.scan-pic{
		width: 40rpx;
		height: 40rpx;
		margin-bottom: 6rpx;
	}
	.scan-label { display: block; color: white; font-size: 22rpx; line-height: 32rpx; }
</style>

<script setup>
	const props = defineProps({
	  active: Number
	})
	const home = {
		active: '/static/image/tab-home-b-active.png',
		default: '/static/image/tab-home-b.png'
	}
	const user = {
		active: '/static/image/tab-user-b-active.png',
		default: '/static/image/tab-user-b.png'
	}
	
	const go = (url) => {
		uni.redirectTo({
			url: url
		})
	}
	const scan = () => {
		uni.scanCode({
			success: function (res) {
				go("/pages/station/create?key=" + res.result)
			},
			fail: function () {
				uni.showToast({ title: '扫码未完成，请使用真机或开发者工具扫码', icon: 'none' })
			}
		})
	}
</script>
