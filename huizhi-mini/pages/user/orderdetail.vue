<template>
	<view class='container b-order-detail'>
		<navbar class='navbar' title='订单详情'></navbar>
		<view class='header f-tac'>
			<text class='title f-ib'>订单{{form.orderState == 1 ? '进行中' : '已完成'}}</text>
			<text class='label f-db'>驭能智充 · 充电记录与费用明细</text>
		</view>
		<view class='card'>
			<text class='station-name f-db'>{{form.address}}</text>
			<text class='card-info f-db'>设备编号：{{form.pileId}}</text>
			<text class='card-info f-db'>设备类型：{{form.pileType == 1 ? '快充' : '慢充'}}</text>
			<text class='card-info f-db'>端口：{{form.portName}}</text>
			<text class='card-info f-db'>电流：{{form.electricity}}A</text>
			<text class='card-info f-db'>电压：{{form.voltage}}V</text>
			<text class='card-info f-db'>最大功率：{{form.maxPower}}kw</text>
		</view>
		<view class='card'>
			<text class='card-title f-db'>订单信息</text>
			<text class='card-info f-db'>充电时长：{{form.hour}}小时</text>
			<text class='card-info f-db'>订单编号：{{form.orderNumber}}</text>
			<text class='card-info f-db'>开始时间：{{form.startTime}}</text>
			<text class='card-info f-db'>结束时间：{{form.endTime}}</text>
		</view>
		<view class='card'>
			<text class='card-title f-db'>支付信息</text>
			<view class='pay'>
				<text class='pay-label'>电费</text>
				<text class='pay-value f-tar'>¥{{form.chargeFee || 0 }}</text>
			</view>
			<view class='pay'>
				<text class='pay-label'>服务费</text>
				<text class='pay-value f-tar'>¥{{form.serviceFee || 0}}</text>
			</view>
			<view class='pay'>
				<text class='pay-label'>支付金额</text>
				<text class='pay-value f-tar'>¥{{form.ordergold || 0}}</text>
			</view>
			<view class='pay'>
				<text class='pay-label'>支付方式</text>
				<text class='pay-value f-tar' style='color: #666;'>{{form.payType || '账户余额扣款'}}</text>
			</view>
		</view>
		<view class='card'>
			<text class='card-title f-db'>订单状态跟踪</text>
			<view class='steps'>
				<view class='step f-pr' v-for='(item, index) in form.logList' v-bind:key='index'>
					<view class='out'>
						<view class='inner f-ib'></view>
					</view>
					<text class='step-time f-fwb f-db'>{{item.createTime}}</text>
					<view class='step-label'>{{item.logContent}}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style scoped>
	.container{
		background: linear-gradient(255deg, #FFEEED, #F3F3F3, #E7ECFF);
		min-height: calc(100vh - 80rpx);
		padding: 150rpx 20rpx 20rpx 20rpx;
	}
	.card{
		background-color: white;
		border-radius: 25rpx;
		padding: 30rpx;
		margin-bottom: 20rpx;
	}
	.header{
		margin-top: 40rpx;
	}
	.title{
		background: url('https://pic.abdl.eu.org/file/a8e12b2777e1a92003503.png') left no-repeat;
		background-size: 56rpx;
		line-height: 60rpx;
		padding-left: 76rpx;
		font-size: 36rpx;
	}
	.label{
		color: #888;
		line-height: 60rpx;
		margin-bottom: 20rpx;
	}
	.station-name{
		font-size: 32rpx;
		margin-bottom: 16rpx;
	}
	.card-title{
		margin-bottom: 16rpx;
	}
	.card-info{
		color: #666;
		line-height: 52rpx;
	}
	.pay{
		line-height: 52rpx;
		display: flex;
	}
	.pay-label{
		width: 140rpx;
		color: #666;
	}
	.pay-value{
		flex: 1;
		color: #333999;
	}
	.out{
		background-color: #D6DEFE;
		width: 30rpx;
		height: 30rpx;
		border-radius: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		left: -15rpx;
		top: 0rpx;
	}
	.inner{
		background-color: #8495DA;
		width: 15rpx;
		height: 15rpx;
		border-radius: 100%;
	}
	.steps{
		padding-left: 15rpx;
		padding-right: 15rpx;
		margin-top: 30rpx;
	}
	.step{
		border-left: #999 dashed 2rpx;
		padding-left: 40rpx;
		padding-bottom: 40rpx;
	}
	.step-time{
		font-size: 36rpx;
		position: relative;
		top: -10rpx;
	}
	.step-label{
		color: #666;
	}
	.amount{
		color: #5164E3;
	}
	.step-warning{
		color: #E06E11;
	}
	.step:last-of-type{
		border-left: none;
		padding-bottom: 20rpx;
	}
</style>

<script setup>
	import { reactive, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import navbar from '../../components/navbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	const form = reactive({})
	const show = (params) => {
		request({
			url: '/order/orderDetail',
			data: params,
			success: res => {
				if (res.data?.code !== 200 || !res.data.data) {
					uni.showToast({ title: res.data?.msg || '订单详情暂不可用，请稍后重试', icon: 'none' })
					return
				}
				for(let key in res.data.data) {
					form[key] = res.data.data[key]
				}
			}
		})
	}
	
	onLoad((option) => {
		show(option)
	})
</script>
