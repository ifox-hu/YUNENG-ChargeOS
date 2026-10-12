<template>
	<view class='container b-create'>
		<navbar class='navbar' title='选择充电'></navbar>
		<view class='header'>
			<text class='staion-name f-db'>{{form.stationName}}</text>
			<text class='address'>{{form.address || '暂无'}}</text>
		</view>
		<view class='main'>
			<view class="charge code-wrapper">
				<view class='code'>桩编码：<text class='f-fwb'>{{form.pileId}}</text></view>
				<van-tag color="#e4f5ef" text-color="#008773" class='type'>
					<text class='type-label'>{{form.pileType == 1 ? '快充' : '慢充'}}</text>
				</van-tag>
			</view>
			<view class='charge'>
				<text class='port-title f-fwb f-db'>选择设备端口</text>
				<van-row class='f-tac' gutter="20">
					<van-col :span='12' v-for='(item, index) in form.list' v-bind:key='index'>
						<van-button v-bind:plain='selected === index ? false : true' round v-bind:type="item.state == 'Y' ? 'default' : 'primary'" v-bind:disabled='item.state == "Y" || item.state == "F"' v-bind:class='selected === index ? "selected" : ""' class='port f-fwb' v-on:click='setport(index)'>
							<text class='port-num f-ib'>{{item.name}} </text> 
							<text v-bind:class='item.state == "Y" ? "busy" : ""'>{{item.state == 'N' ? '空闲' : item.state == 'Y' ? '使用中' : '故障'}}</text>
						</van-button>
					</van-col>
				</van-row>
			</view>
			<view class='charge'>
				<text class='f-fwb f-db'>选择充电时长</text>
				<van-row gutter='20' class='f-tac'>
					<van-col :span='8' v-for='(item, index) in times' v-bind:key='index'>
						<view v-on:click='setime(index)'>
							<van-tag class='time' v-bind:class='activetime === index ? "active" : "default"' v-bind:color="activetime === index ? '#e4f5ef' : 'white'" v-bind:text-color="activetime === index ? '#008773' : '#666'">{{item}}{{item == '智能充满' ? '' : '小时'}}</van-tag>
						</view>
					</van-col>
					<van-col :span='8'>
						<view v-on:click='customtimeshow = true'>
							<van-tag class='time default' color="white" text-color="#666">自定义时间</van-tag>
						</view>
					</van-col>
				</van-row>
			</view>
			<view class='charge'>
				<text class='port-title f-fwb f-db'>计费标准</text>
				<text class='price-label f-db'>[尖] 13:00-24:00 电费:1.0044元/度，服务费:0.1元/度</text>
				<text class='price-label f-db'>[峰] 10:00-13:00 电费:1.0044元/度，服务费:0.1元/度</text>
				<text class='price-label f-db'>[平] 08:00-10:00 电费:0.695元/度，服务费:0.1元/度</text>
				<text class='price-label f-db'>[谷] 00:00-08:00 电费:0.3946元/度，服务费:0.1元/度</text>
			</view>
		</view>
		<view class='footer'>
			<van-button type='primary' :loading='starting' :disabled='starting' v-on:click='start'>{{starting ? '正在开启…' : '开始充电'}}</van-button>
		</view>
		<van-popup v-model:show="customtimeshow" position='bottom' class='popup'>
			<input class='input' v-model="customtime" type="digit" placeholder='请输入时间(单位小时)' />
			<van-row gutter='20' class='time-footer f-db f-tac'>
				<van-col :span='12'>
					<van-button type='primary' size='small' v-on:click='subtime'>确定</van-button>
				</van-col>
				<van-col :span='12'>
					<van-button type='default' size='small' v-on:click='customtimeshow = false'>取消</van-button>
				</van-col>
			</van-row>
		</van-popup>
	</view>
</template>

<style scoped>
	.container{
		background: linear-gradient(-42deg, #E7FFFA, #EFF5FF, #FCFDEF);
		padding-top: 160rpx;
		min-height: calc(100vh - 80rpx);
		padding-bottom: 80rpx;
	}
	.main{
		margin-left: 20rpx;
		margin-right: 20rpx;
	}
	.header{
		margin-left: 20rpx;
		margin-right: 20rpx;
		padding: 20rpx;
	}
	.staion-name{
		font-family: Microsoft YaHei;
		font-weight: bold;
		font-size: 36rpx;
		color: #17141B;
		line-height: 60rpx;
		margin-bottom: 20rpx;
	}
	.address{
		color: #666;
	}
	.charge{
		background-color: white;
		padding: 20rpx;
		border-radius: 20rpx;
		margin-top: 20rpx;
	}
	.code-wrapper{
		display: flex;
	}
	.code{
		flex: 1;
		font-size: 32rpx;
		margin-top: 6rpx;
	}
	.type-label{
		height: 52rpx;
		line-height: 52rpx;
		padding-left: 20rpx;
		padding-right: 20rpx;
	}
	.port-title{
		font-size: 32rpx;
		margin-bottom: 20rpx;
	}
	.port /deep/ .van-button--primary, .port /deep/ .van-button--default{
		width: 100%;
		height: 88rpx;
	}
	.port-num{
		font-size: 32rpx;
		margin-right: 4rpx;
	}
	.busy{
		color: #F16A19;
	}
	.selected /deep/ .van-button--primary {
		background: linear-gradient(96deg, #16b99c, #008773);
	}
	.port /deep/ .van-button--primary {
		border: 2rpx solid #008773;
		color: white;
	}
	.port /deep/ .van-button--default {
		border: 2rpx solid #999;
	}
	.port /deep/ .van-button--plain.van-button--primary {
		background-color: white;
		color: #008773;
	}
	.time /deep/ .van-tag{
		width: calc(100% - 20rpx);
		height: 88rpx;
		line-height: 88rpx;
		margin-top: 20rpx;
		font-size: 28rpx;
		display: inline-block;
		border-radius: 10rpx;
	}
	.active /deep/ .van-tag{
		border: #008773 solid 2rpx;
	}
	.default /deep/ .van-tag{
		border: #D8DCE0 solid 2rpx;
	}
	.popup{
		padding: 20rpx;
	}
	.time-footer{
		margin-top: 20rpx;
	}
	.time-footer /deep/ .van-button--small{
		width: 80%;
	}
	.input{
		width: calc(100% - 80rpx);
		margin: 20rpx auto;
		height: 60rpx;
		line-height: 60rpx;
	}
	.price-label{
		color: #888;
		line-height: 48rpx;
	}
	.footer{
		position: fixed;
		left: 0;
		bottom: 0;
		width: 100%;
		background-color: white;
		padding: 20rpx;
	}
	.footer /deep/ .van-button--primary {
		border: 2rpx solid #008773;
		color: white;
		background: linear-gradient(96deg, #16b99c, #008773);
		width: calc(100% - 40rpx);
		border-radius: 80rpx;
	}
</style>

<script setup>
	import { ref, reactive } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import navbar from '../../components/navbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	
	const selected = ref('')
	const setport = (index) => {
		if (form.list?.[index]?.state !== 'N') return
		selected.value = index
	}
	const form = reactive({})
	const starting = ref(false)
	const key = ref('')
	
	const show = (params) => {
		request({
			url: '/charging/getChargingPileData',
			data: params,
			success: res => {
				if (res.data?.code !== 200 || !res.data.data) {
					uni.showToast({ title: res.data?.msg || '设备加载失败', icon: 'none' })
					return
				}
				for(let key in res.data.data){
					form[key] = res.data.data[key]
				}
			}
		})
	}
	
	const times = ref([
		'智能充满',
		'1',
		'2',
		'3'
	])
	const activetime = ref(0)
	const customtimeshow = ref(false)
	const customtime = ref('')
	const setime = (index) => {
		activetime.value = index
	}
	const subtime = () => {
		if(customtime.value) {
			if(!/^\d+$/.test(String(customtime.value)) || Number(customtime.value) < 1 || Number(customtime.value) > 24) {
				uni.showToast({
					title: '请输入1至24的整数小时',
					icon: 'none'
				})
			}else{
				if(times.value.includes(customtime.value)) {
					setime(times.value.indexOf(customtime.value))
				}else{
					if(times.value.length == 4) {
						times.value.push(customtime.value)
					}else{
						times.value[times.value.length - 1] = customtime.value
					}
					setime(times.value.length - 1)
				}
				customtimeshow.value = false
			}
		}else{
			uni.showToast({
				title: '请输入自定义时间',
				icon: 'none'
			})
		}
	}
	
	const start = () => {
		if (starting.value) return
		const token = uni.getStorageSync('token')
		const user = uni.getStorageSync('user') || {}
		if(token) {
			if(selected.value === '') {
				uni.showToast({
					title: '请选择设备端口',
					icon: 'none'
				})
			}else{
				const port = form.list?.[selected.value]
				if (!port || port.state !== 'N' || !user.memberId) {
					uni.showToast({ title: '端口不可用或登录已失效，请重新选择', icon: 'none' })
					return
				}
				starting.value = true
				request({
					url: '/order/saveOrder',
					data: {
						amount: 50,
						hour: times.value[activetime.value] == '智能充满' ? 12 : times.value[activetime.value],
						portId: form.list[selected.value].portId,
						userId: user.memberId
					},
					success: res => {
						const order = res.data?.data
						if(res.data?.code == 200 && order?.orderNumber && order.portId && order.pileId) {
							const params = { stationName: form.stationName || '', port: order.portId,
								portId: order.portId, pileId: order.pileId, portname: port.name || '',
								orderNumber: order.orderNumber, hour: order.hour, delta: 3 }
							const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&')
							uni.redirectTo({
								url: '/pages/station/powering?' + query,
								success: () => uni.showToast({ title: '成功开启充电' }),
								fail: () => uni.showModal({ title: '订单已创建',
									content: '充电页面打开失败，请从“我的 → 订单”进入，勿重复开始充电。', showCancel: false })
							})
						}else{
							uni.showToast({
								title: res.data?.msg || '启动失败或订单信息缺失，请检查订单列表',
								icon: 'none'
							})
						}
					},
					complete: () => { starting.value = false }
				})
			}
		}else{
			uni.setStorageSync('redirecturl', '/pages/station/create?key=' + key.value)
			go('/pages/user/login')
		}
	}
	
	const go = (url) => {
		uni.navigateTo({
			url: url
		})
	}
	
	onLoad((option) => {
		key.value = option.key
		show(option)
	})
</script>
