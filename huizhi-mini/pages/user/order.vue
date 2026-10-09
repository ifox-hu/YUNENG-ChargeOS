<template>
	<view class='container b-orders'>
		<navbar class='navbar' title='我的订单'></navbar>
		<van-row class='tabs f-tac f-db'>
			<van-col :span='8'>
				<text class='title' v-bind:class='query.orderStatus === "" ? "f-fwb" : "title-normal"' v-on:click='setactive("")'>全部</text>
				<text class='f-db' v-bind:class='query.orderStatus === "" ? "line" : "unline"'></text>
			</van-col>
			<van-col :span='8'>
				<text class='title' v-bind:class='query.orderStatus == 1 ? "f-fwb" : "title-normal"' v-on:click='setactive(1)'>进行中</text>
				<text class='f-db' v-bind:class='query.orderStatus == 1 ? "line" : "unline"'></text>
			</van-col>
			<van-col :span='8'>
				<text class='title' v-bind:class='query.orderStatus == 3 ? "f-fwb" : "title-normal"' v-on:click='setactive(3)'>已完成</text>
				<text class='f-db' v-bind:class='query.orderStatus == 3 ? "line" : "unline"'></text>
			</van-col>
		</van-row>
		<view class="order" v-for='(item, index) in orders' v-bind:key='index' v-on:click='show(item)'>
			<view class='order-header'>
				<text class='order-num f-fwb'>单号:{{item.orderNumber}}</text>
				<text class='finish f-tac' type='primary' v-if='item.orderState == "3"'>已完成</text>
				<text class='ing f-tac' type='primary' v-if='item.orderState == "1"'>进行中</text>
			</view>
			<view class='order-body'>
				<view class='order-info'>
					<text class='order-label'>开始时间：</text>
					<text class='order-value f-tar'>{{item.startTime}}</text>
				</view>
				<view class='order-info'>
					<text class='order-label'>结束时间：</text>
					<text class='order-value f-tar'>{{item.endTime}}</text>
				</view>
				<view class='order-info'>
					<text class='order-label'>已充电量：</text>
					<text class='order-value f-tar'>{{item.consumePower}}度</text>
				</view>
				<view class='order-info'>
					<text class='order-label'>充电时长：</text>
					<text class='order-value f-tar'>{{item.hour}}小时</text>
				</view>
				<view class='order-info'>
					<text class='order-label'>充电用户：</text>
					<text class='order-value f-tar'>{{item.userName || ''}}</text>
				</view>
			</view>
			<view class='order-footer f-tar'>
				<text class='money-label'>金额：</text>
				<text class='money-value f-fwb'>{{item.ordergold || 0}}元</text>
			</view>
		</view>
		<text class='more f-tac f-db'>{{ moreText }}</text>
	</view>
</template>

<style scoped>
	.container{
		background: linear-gradient(255deg, #FFEEED, #F3F3F3, #E7ECFF);
		min-height: calc(100vh - 80rpx);
		padding: 160rpx 20rpx 20rpx 20rpx;
	}
	.tabs{
		padding-top: 30rpx;
	}
	.line{
		background: linear-gradient(270deg, #FDEFEE, #5F70F4, #374EF7);
	}
	.unline{
		background: rgba(255, 255, 255, 0);
	}
	.line,.unline{
		width: 80rpx;
		height: 6rpx;
		margin: 0 auto;
	}
	.title-normal{
		color: #888;
	}
	.order{
		background-color: white;
		margin-top: 20rpx;
		border-radius: 25rpx;
		padding: 20rpx;
	}
	.order-header{
		display: flex;
		border-bottom: #ddd solid 2rpx;
		padding-bottom: 20rpx;
	}
	.order-num{
		flex: 1;
		color: #17141B;
		line-height: 50rpx;
		font-size: 24rpx;
	}
	.finish{
		background: linear-gradient(270deg, #5086F9, #5569FF);
	}
	.ing{
		background: linear-gradient(270deg, #70CAF3, #44E590);
	}
	.finish,.ing{
		color: white;
		width: 100rpx;
		height: 50rpx;
		line-height: 50rpx;
		border-radius: 10rpx;
		font-size: 24rpx;
	}
	.order-body{
		padding-top: 20rpx;
		padding-bottom: 30rpx;
	}
	.order-info{
		display: flex;
		line-height: 48rpx;
	}
	.order-label{
		width: 140rpx;
		color: #999;
	}
	.order-value{
		flex: 1;
		color: #333;
	}
	.money-value{
		color: #4369F8;
	}
	.more{
		margin-top: 10rpx;
		color: #999;
	}
</style>

<script setup>
	import { ref, reactive, onMounted } from 'vue'
	import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
	import navbar from '../../components/navbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	const query = reactive({
		orderStatus: '',
		pageNo: 1,
		pageSize: 5,
		userId: uni.getStorageSync('user').memberId
	})
	const setactive = (i) => {
		if (loading.value) return
		query.orderStatus = i
		index(1)
	}
	
	const go = (url) => {
		uni.navigateTo({
			url: url
		})
	}
	const show = (form) => {
		if(form.orderState == 1) {
			go(`/pages/station/powering?stationName=${form.stationName}&port=${form.portId}&portId=${form.portId}&pileId=${form.pileId}&portname=${form.portName}&orderNumber=${form.orderNumber}&hour=${form.hour}&delta=1`)
		}else if(form.orderState == 3) {
			go("/pages/user/orderdetail?orderNumber=" + form.orderNumber)
		}
	}
	
	const orders = ref([])
	const loadall = ref(false)
	const loading = ref(false)
	const moreText = ref('上滑加载更多~')
	const index = (page) => {
		if (loading.value) return
		if (!uni.getStorageSync('token') || !query.userId) {
			moreText.value = '请先登录查看订单'
			uni.stopPullDownRefresh()
			return
		}
		loading.value = true
		moreText.value = '加载中...'
		request({
			url: '/order/queryOrderList',
			data: { ...query, pageNo: page },
			success: res => {
				if (res.data?.code !== 200 || !Array.isArray(res.data.data?.records)) {
					moreText.value = res.data?.msg || '订单加载失败，请下拉重试'
					return
				}
				const records = res.data.data.records
				orders.value = page === 1 ? records : orders.value.concat(records)
				query.pageNo = page
				loadall.value = records.length < query.pageSize || (res.data.data.total != null && orders.value.length >= res.data.data.total)
				moreText.value = orders.value.length === 0 ? '暂无订单' : loadall.value ? '没有更多了~' : '上滑加载更多~'
			},
			fail: () => { moreText.value = '网络异常，请下拉重试' },
			complete: () => { loading.value = false; uni.stopPullDownRefresh() }
		})
	}
	onMounted(() => {
		index(1)
	})
	onPullDownRefresh(() => {
		loadall.value = false
		index(1)
	})
	onReachBottom(() => {
		if (!loadall.value && !loading.value) index(query.pageNo + 1)
	})
</script>
