<template>
<view class="profile-page">
  <page-header title="我的" fallback="/pages/index/index" />
  <view class="profile-body">
    <view class="profile-identity">
      <image class="profile-avatar" src="/static/image/avatar.png" mode="aspectFill" />
      <view class="profile-name-group"><text class="profile-name" @click="openAccount">{{token ? (phone || user.userName || '充电用户') : '登录后开启充电服务'}}</text><text class="profile-caption">{{token ? '安心充电 · 服务随行' : '查看订单与报修进度'}}</text></view>
      <view class="profile-tools"><view class="points-badge" @click="goabort('/pages/wallet/points')">积分 {{score}}</view><button class="profile-settings" hover-class="profile-pressed" aria-label="账户设置" @click="goabort('/pages/user/setting')"><view class="settings-mark"></view></button></view>
    </view>
    <view class="wallet-card">
      <view class="wallet-cell wallet-click" hover-class="wallet-pressed" @click="goabort('/pages/wallet/balance')"><text class="wallet-number">{{formatValue(balance,2)}}</text><text class="wallet-caption">账户余额 · 元</text><text class="wallet-link">查看流水 ›</text></view>
      <view class="wallet-cell wallet-click" hover-class="wallet-pressed" @click="goabort('/pages/wallet/points')"><text class="wallet-number">{{score}}</text><text class="wallet-caption">可用积分</text><text class="wallet-link">签到领积分 ›</text></view>
    </view>
    <view class="section-heading"><text>充电与服务</text><text class="section-note">常用功能</text></view>
    <view class="service-menu">
      <view class="service-item" hover-class="service-pressed" @click="goabort('/pages/user/order')"><view class="service-icon order-icon"><view class="paper-symbol"><view></view><view></view><view></view></view></view><view class="service-copy"><text class="service-title">充电订单</text><text class="service-subtitle">查看充电记录和费用明细</text></view><view class="service-chevron"></view></view>
      <view class="service-item" hover-class="service-pressed" @click="goabort('/pages/repair/create')"><view class="service-icon repair-icon"><text class="repair-symbol">!</text></view><view class="service-copy"><text class="service-title">设备故障报修</text><text class="service-subtitle">扫码或输入桩编号，提交问题</text></view><view class="service-chevron"></view></view>
      <view class="service-item" hover-class="service-pressed" @click="goabort('/pages/repair/list')"><view class="service-icon progress-icon"><view class="clock-symbol"><view></view></view></view><view class="service-copy"><text class="service-title">我的报修</text><text class="service-subtitle">跟踪处理进度，确认修复结果</text></view><view class="service-chevron"></view></view>
    </view>
    <view class="month-card">
      <view class="month-heading"><text>本月充电情况</text><button class="month-refresh" hover-class="profile-pressed" :disabled="statsLoading || !token" @click="getmonth">{{statsLoading ? '更新中' : '刷新'}}</button></view>
      <view v-if="statsError" class="summary-error">{{statsError}}</view>
      <view class="month-grid">
        <view class="month-cell"><text class="month-number">{{formatValue(month.chargeDegree,1)}}</text><text class="month-unit">度</text><text class="month-label">累计电量</text></view>
        <view class="month-cell"><text class="month-number">{{formatValue(month.chargeAmount,2)}}</text><text class="month-unit">元</text><text class="month-label">充电金额</text></view>
        <view class="month-cell"><text class="month-number">{{formatValue(month.chargeTime,1)}}</text><text class="month-unit">小时</text><text class="month-label">充电时长</text></view>
      </view><text class="month-footnote">{{token ? '根据本月充电记录汇总' : '登录后查看本月充电记录'}}</text>
    </view>
  </view><tabbar :active="1" />
</view>
</template>
<style scoped>
.profile-page{min-height:100vh;background:#f3f7f5;color:#1d3731;font-size:28rpx;box-sizing:border-box;padding-bottom:calc(160rpx + env(safe-area-inset-bottom))}.profile-body{padding:16rpx 28rpx 32rpx}.profile-identity{display:flex;align-items:center;padding:20rpx 4rpx 30rpx}.profile-avatar{height:96rpx;width:96rpx;border:6rpx solid white;border-radius:50%;flex-shrink:0}.profile-name-group{flex:1;min-width:0;padding:0 20rpx}.profile-name{display:block;font-size:32rpx;font-weight:700;line-height:1.5;word-break:break-all}.profile-caption{display:block;font-size:23rpx;color:#789085;margin-top:6rpx}.profile-tools{display:flex;align-items:center;gap:4rpx;flex-shrink:0}.points-badge{padding:10rpx 14rpx;border-radius:20rpx;background:#e2f3ed;color:#008773;font-size:22rpx;white-space:nowrap}.profile-settings{width:72rpx;height:88rpx;padding:0;margin:0;display:flex;align-items:center;justify-content:center;background:transparent;border-radius:18rpx;flex-shrink:0}.profile-settings::after{border:0}.settings-mark{width:28rpx;height:28rpx;border:4rpx solid #45685b;border-radius:8rpx;transform:rotate(45deg);box-sizing:border-box}.settings-mark::after{content:'';display:block;width:8rpx;height:8rpx;border:3rpx solid #45685b;border-radius:50%;margin:4rpx}.profile-pressed{background:#dfede6}
.wallet-card{display:flex;padding:32rpx 12rpx;border-radius:24rpx;background:linear-gradient(115deg,#008773,#1aa98c);color:white;box-shadow:0 12rpx 28rpx rgba(0,135,115,.1)}.wallet-cell{flex:1;min-width:0;text-align:center;padding:6rpx 8rpx;box-sizing:border-box}.wallet-cell + .wallet-cell{border-left:1rpx solid rgba(255,255,255,.25)}.wallet-number{display:block;font-size:36rpx;font-weight:700;line-height:1.3;word-break:break-all}.wallet-caption{display:block;color:#d8f1e8;font-size:23rpx;margin-top:12rpx}.wallet-link{display:block;color:#fff;font-size:20rpx;opacity:.8;margin-top:10rpx}.wallet-pressed{background:rgba(255,255,255,.12);border-radius:16rpx}
.section-heading{display:flex;align-items:center;justify-content:space-between;margin:34rpx 4rpx 18rpx;font-size:30rpx;font-weight:600}.section-note{font-size:23rpx;font-weight:400;color:#91a198}.service-menu{background:white;border:1rpx solid #e5ede8;border-radius:24rpx;overflow:hidden}.service-item{display:flex;align-items:center;min-height:132rpx;padding:22rpx 26rpx;box-sizing:border-box}.service-item + .service-item{border-top:1rpx solid #edf2ef}.service-pressed{background:#edf7f1}.service-icon{display:flex;align-items:center;justify-content:center;width:72rpx;height:72rpx;border-radius:20rpx;flex-shrink:0;margin-right:22rpx}.order-icon{background:#e4f3ed;color:#008773}.repair-icon{background:#fff1de;color:#b8751b}.progress-icon{background:#eaf0fa;color:#547caf}.service-copy{flex:1;min-width:0}.service-title{display:block;font-size:29rpx;font-weight:600;line-height:1.45}.service-subtitle{display:block;font-size:23rpx;color:#8a9b92;line-height:1.5;margin-top:6rpx}.service-chevron{width:12rpx;height:12rpx;border-top:3rpx solid #a5b4ac;border-right:3rpx solid #a5b4ac;transform:rotate(45deg);flex-shrink:0;margin-left:16rpx}.paper-symbol{width:26rpx;height:32rpx;border:3rpx solid #008773;border-radius:5rpx;padding:5rpx;box-sizing:content-box}.paper-symbol view{height:3rpx;background:#008773;margin:4rpx 0}.repair-symbol{width:34rpx;height:34rpx;border:3rpx solid #b8751b;border-radius:50%;line-height:34rpx;text-align:center;font-size:28rpx;font-weight:700}.clock-symbol{width:36rpx;height:36rpx;border:3rpx solid #547caf;border-radius:50%;position:relative}.clock-symbol view{position:absolute;left:16rpx;top:6rpx;width:10rpx;height:13rpx;border-left:3rpx solid #547caf;border-bottom:3rpx solid #547caf}
.month-card{margin-top:26rpx;background:white;border:1rpx solid #e5ede8;border-radius:24rpx;padding:24rpx}.month-heading{display:flex;align-items:center;justify-content:space-between;font-size:29rpx;font-weight:600}.month-refresh{padding:0 18rpx;margin:0;height:88rpx;line-height:88rpx;font-size:23rpx;font-weight:400;color:#008773;background:transparent}.month-refresh::after{border:0}.month-grid{display:flex;margin:26rpx 0 24rpx}.month-cell{flex:1;min-width:0;text-align:center;padding:0 12rpx;box-sizing:border-box}.month-cell + .month-cell{border-left:1rpx solid #e7eee9}.month-number{display:block;font-size:36rpx;font-weight:700;line-height:1.4;color:#008773;word-break:break-all}.month-unit{display:block;font-size:22rpx;color:#8a9b92;margin:4rpx 0 10rpx}.month-label{display:block;font-size:24rpx;color:#526d61;line-height:1.5;white-space:nowrap}.month-footnote{display:block;text-align:center;font-size:22rpx;color:#95a59c;border-top:1rpx solid #edf2ef;padding-top:20rpx}.summary-error{font-size:23rpx;color:#b8751b;padding-top:16rpx}
</style>

<script setup>
	import { ref, reactive } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import pageHeader from '../../components/page-header/index.vue'
	import tabbar from '../../components/tabbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	const token = ref('')
	const user = reactive({})
	const phone = ref('')
	const score = ref(0)
	const getscore = () => {
		request({
			url: 'points/summary',
			success: res => {
				score.value = Number(res.data?.data?.credit || 0)
			}
		})
	}
	
	const month = reactive({})
  const statsLoading = ref(false)
  const statsError = ref('')
  const formatValue = (value, digits = 1) => { const n = Number(value); return (Number.isFinite(n) ? n : 0).toFixed(digits) }
  const openAccount = () => { if(!token.value) go('/pages/user/login') }
	const getmonth = () => {
    if(statsLoading.value) return
    statsLoading.value = true
    statsError.value = ''
    request({url: 'me/queryMonthTotalByUserId',data: {userId:user.memberId},
      success: res => {
        if(res.data?.code !== 200) {statsError.value = '统计暂不可用，请点击刷新重试'; return}
        Object.assign(month,res.data.data || {})
      },
      fail: () => {statsError.value = '网络连接失败，请点击刷新重试'},
      complete: () => {statsLoading.value = false}
    })
  }
  const balance = ref(0)
	const getbalance = () => {
		request({
			url: 'wallet/summary',
			success: res => {
				balance.value = Number(res.data?.data?.amount || 0)
			}
		})
	}
	
	const go = (url) => {
		uni.navigateTo({
			url: url
		})
	}
	const goabort = (url) => {
		if(token.value) {
			go(url)
		}else{
      go('/pages/user/login')
			uni.showToast({
				title: '您还未登录，请先登录',
				icon: 'none'
			})
		}
	}
	
	onShow(() => {
		token.value = uni.getStorageSync('token') || ''
		phone.value = uni.getStorageSync('phone') || ''
		Object.keys(user).forEach(key => delete user[key])
		Object.assign(user, uni.getStorageSync('user') || {})
		score.value = 0
		balance.value = 0
		Object.keys(month).forEach(key => delete month[key])
		if(token.value && user.memberId) {
			getscore()
			getbalance()
			getmonth()
		}
	})
</script>
