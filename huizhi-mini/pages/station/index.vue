<template>
	<view class='container b-station'>
		<navbar class='navbar' title='电站主页'></navbar>
		<view class='b-station-intro'><text class='b-eyebrow'>驭能智充 · 站点服务</text><text class='b-heading'>选择空闲充电桩</text><text class='b-description'>查看设备状态，选择端口开启充电</text></view>
		<view class='main'>
			<view class='charge'>
				<view class='device' v-for='(item, index) in form.fastPileList' v-bind:key='index' v-on:click='item.notBusyNum > 0 ? go("/pages/station/create?key=" + item.pileNo) : ""'>
					<text class='device-aside f-tac' v-bind:class='item.notBusyNum > 0 ? "device-free" : "device-busy"'>{{item.notBusyNum > 0 ? '空闲' : '忙碌'}}</text>
					<view class='device-main f-pr'>
						<text class='f-db'>充电桩编号：{{item.pileNo}}</text>
						<text class='f-db'>电流：{{item.electricity}}A</text>
						<text class='f-db'>电压：{{item.voltage}}V</text>
						<view class='device-power'>
							<text class='device-type'>快充</text> | 最大功率 {{item.maxPower}} KW
						</view>
						<van-button v-if='item.notBusyNum > 0' type='primary' size='mini' class='point-power'>点击充电</van-button>
					</view>
				</view>
				<view class='device' v-for='(item, index) in form.slowPileList' v-bind:key='index' v-on:click='item.notBusyNum > 0 ? go("/pages/station/create?key=" + item.pileNo) : ""'>
					<text class='device-aside f-tac' v-bind:class='item.notBusyNum > 0 ? "device-free" : "device-busy"'>{{item.notBusyNum > 0 ? '空闲' : '忙碌'}}</text>
					<view class='device-main f-pr'>
						<text class='f-db'>充电桩编号：{{item.pileNo}}</text>
						<text class='f-db'>电流：{{item.electricity}}A</text>
						<text class='f-db'>电压：{{item.voltage}}V</text>
						<view class='device-power'>
							<text class='device-type'>慢充</text> | 最大功率 {{item.maxPower}} KW
						</view>
						<van-button v-if='item.notBusyNum > 0' type='primary' size='mini' class='point-power'>点击充电</van-button>
					</view>
				</view>
			</view>
		</view>
		<view class='footer'>
			<view class='footer-main price'>
				¥<text class='price-value f-fwb'>{{form.price}}</text>/度
			</view>
			<van-button round class='footer-aside f-fwb' color="linear-gradient(to right, #16b99c, #008773)" v-on:click="scan">扫码充电</van-button>
		</view>
		<!--<view class='custom f-tac'>
			<image src='../../static/image/customer.png' mode='widthFix' class='customer'></image>
			<text>联系客服</text>
		</view>-->
	</view>
</template>

<style scoped>
	.container{
		background-color: #f3f3f3;
		padding-top: 160rpx;
		padding-bottom: 120rpx;
	}
	.banner{
		width: 100%;
		height: 100rpx;
		margin-top: 30rpx;
	}
	.main{
		margin: 20rpx;
	}
	.station-info{
		background-color: white;
		padding: 20rpx;
		border-radius: 20rpx;
		margin-top: -100rpx;
		position: relative;
		z-index: 20;
	}
	.staion-name{
		font-family: Microsoft YaHei;
		font-weight: bold;
		font-size: 36rpx;
		color: #17141B;
		line-height: 60rpx;
		margin-bottom: 20rpx;
	}
	.station-position{
		display: flex;
	}
	.position-main{
		flex: 1;
	}
	.position-aside{
		width: 100rpx;
		font-family: Microsoft YaHei;
		font-weight: 400;
		color: #16151B;
	}
	.direction{
		width: 60rpx;
	}
	.distance{
		font-family: Microsoft YaHei;
		font-weight: 400;
		color: #16151B;
		line-height: 50rpx;
	}
	.charge{
		background-color: white;
		padding: 20rpx;
		border-radius: 20rpx;
		margin-top: 20rpx;
	}
	.charge-title{
		font-size: 32rpx;
		line-height: 60rpx;
		margin-bottom: 10rpx;
	}
	.charge-info{
		display: flex;
	}
	.charge-main{
		flex: 1;
		padding-left: 30rpx;
	}
	.charge-aside{
		width: 180rpx;
	}
	.time{
		padding-left: 10rpx;
		padding-right: 10rpx;
	}
	.time-label{
		color: #444;
		margin-top: 6rpx;
	}
	.price{
		color: #F95731;
		margin-top: -4rpx;
	}
	.price-value{
		font-size: 36rpx;
	}
	.price-detail{
		color: #999999;
	}
	.price-detail-item{
		margin-right: 20rpx;
	}
	.park{
		width: 44rpx;
		height: 44rpx;
		line-height: 40rpx;
		background: #E9EDFF;
		border-radius: 10rpx;
		font-weight: bold;
		color: #4A6EF3;
		margin-right: 20rpx;
		position: relative;
		top: -4rpx;
	}
	.park-price{
		color: #000;
		margin-top: 10rpx;
		margin-bottom: 10rpx;
	}
	.park-label{
		color: #999;
	}
	.speed{
		display: flex;
		border-radius: 20rpx;
	}
	.fast{
		border: 2rpx solid #5C75E2;
		margin-bottom: 20rpx;
	}
	.slow{
		border: 2rpx solid #F3A841;
	}
	.speed-main{
		flex: 1;
	}
	.speed-aside{
		width: 200rpx;
		color: #666;
		line-height: 72rpx;
	}
	.speed-label{
		color: white;
		margin-right: 30rpx;
		border-radius: 20rpx 58rpx 58rpx 20rpx;
		text-indent: 20rpx;
		width: 100rpx;
		height: 72rpx;
		line-height: 72rpx;
	}
	.fast-label{
		background: linear-gradient(96deg, #569AFF, #4A6EF3);
	}
	.slow-label{
		background: linear-gradient(96deg, #F4B44F, #EF8B1F);
	}
	.use{
		color: #999;
	}
	.use-value{
		color: #000;
	}
	.device{
		display: flex;
		margin-bottom: 40rpx;
		margin-top: 20rpx;
	}
	.device-aside{
		border-radius: 100%;
		width: 120rpx;
		height: 120rpx;
		line-height: 120rpx;
		margin-top: 10rpx;
	}
	.device-free{
		border: 10rpx solid #ADF6CC;
		color: #ADF6CC;
	}
	.device-busy{
		border: 10rpx solid #FBC2B5;
		color: #FBC2B5;
	}
	.device-main{
		flex: 1;
		padding-left: 20rpx;
		color: #666;
	}
	.device-power{
		color: #444;
	}
	.device-type{
		color: #003ECC;
	}
	.footer{
		display: flex;
		background-color: white;
		position: fixed;
		left: 0;
		bottom: 0;
		padding: 30rpx 20rpx;
		width: 100%;
		box-shadow: 0px 0px 16px 0px #E3E3E3;
	}
	.footer-main{
		flex: 1;
		margin-top: 16rpx;
	}
	.footer-aside{
		width: 180rpx;
		height: 60rpx;
		line-height: 60rpx;
		margin-right: 30rpx;
		margin-bottom: 20rpx;
	}
	.custom{
		width: 80rpx;
		height: 160rpx;
		background: #FFFFFF;
		box-shadow: 0px 0px 18rpx 0px rgba(171,171,171,0.52);
		position: fixed;
		top: 40%;
		right: 20rpx;
		color: #444;
		border-radius: 60rpx;
		padding-top: 20rpx;
	}
	.customer{
		width: 54rpx;
	}
	.point-power{
		position: absolute;
		right: 0;
		top: 60rpx;
	}
</style>

<script setup>
	import { reactive } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import navbar from '../../components/navbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	
	const go = (url) => {
		uni.navigateTo({
			url: url
		})
	}
	
	const navigator = () => {
		uni.openLocation({
			latitude: form.lat,
			longitude: form.lng,
			success: function () {
				console.log('success')
			}
		})
	}
	
	const form = reactive({ fastPileList: [], slowPileList: [], price: '--' })
	const show = (params) => {
		request({
			url: '/charging/plotDetail',
			data: params,
			success: res => {
				if (res.data.code !== 200 || !res.data.data) {
					uni.showToast({ title: res.data.msg || '站点信息暂不可用', icon: 'none' })
					return
				}
				for(let key in res.data.data) {
					form[key] = res.data.data[key]
				}
			}
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
	
	onLoad((option) => {
		form.distance = option.distance
		show(option)
	})
</script>
