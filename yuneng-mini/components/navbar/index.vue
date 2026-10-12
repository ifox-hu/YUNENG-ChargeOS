<template>
	<view class='bar f-tac'>
		<view class='bar-main f-pr'>
			<view class='icon' v-if='showarrow' @click='back(delta)'>
				<van-icon name="arrow-left" size='20px'/>
			</view>
			<text class='title'>{{title}}</text>
		</view>
	</view>
</template>

<style scoped>
	.bar{
		position: fixed;
		top: 0rpx;
		padding-top: 110rpx;
		left: 0;
		width: 100%;
		background-color: white;
		z-index: 100;
		padding-bottom: 20rpx;
	}
	.icon{
		position: absolute;
		left: 0;
		top: -20rpx;
		width: 88rpx;
		height: 88rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.title{
		color: #1d3731;
		font-size: 32rpx;
		font-weight: 600;
	}
</style>

<script setup>
	const props = defineProps({
	  title: String,
		showarrow: {
			type: Boolean,
			default: true
		},
		delta: {
			type: Number,
			default: 1
		}
	})
	
	const back = (delta) => {
		const pages = getCurrentPages()
		const home = () => uni.reLaunch({ url: '/pages/index/index' })
		if (pages.length <= 1) {
			home()
			return
		}
		const steps = Number.isFinite(delta) ? Math.floor(delta) : 1
		uni.navigateBack({
			delta: Math.min(Math.max(steps, 1), pages.length - 1),
			fail: home
		})
	}
</script>

