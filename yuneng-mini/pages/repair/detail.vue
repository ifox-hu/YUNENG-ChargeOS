<template>
  <page-header title="报修进度" fallback="/pages/repair/list" />
  <view class="detail-page">
    <view v-if="error" class="empty">{{error}}<button size="mini" @click="load">重试</button></view>
    <view v-if="detail.ticket && !error">
      <view class="state"><text class="status">{{statuses[detail.ticket.status]}}</text><text class="subtitle">{{tips[detail.ticket.status]}}</text></view>
      <view class="panel">
        <text class="section-title">报修信息</text>
        <view class="field">设备编号 <text>{{detail.ticket.pileId}}</text></view>
        <view class="field">故障类型 <text>{{faultLabel(detail.ticket.faultType)}}</text></view>
        <view class="field">处理人 <text>{{detail.ticket.assigneeName || '等待分配'}}</text></view>
        <view class="field">提交时间 <text>{{detail.ticket.createdAt}}</text></view>
        <text class="description">{{detail.ticket.description}}</text>
        <text class="ticket-no">{{detail.ticket.ticketNo}}</text>
      </view>
      <view class="panel">
        <text class="section-title">处理进度</text>
        <view v-for="log in detail.logs" :key="log.id" class="step"><view class="dot"></view><view class="step-body"><text class="step-title">{{statuses[log.toStatus]}}</text><text class="note">{{log.note}}</text><text class="time">{{log.createdAt}}</text></view></view>
      </view>
      <button v-if="detail.ticket.status==='RESOLVED'" class="confirm" hover-class="action-pressed" :loading="confirming" :disabled="confirming" @click="confirm">问题已解决，确认关闭</button>
      <button class="refresh" hover-class="action-pressed" :loading="loading" :disabled="loading" @click="load">{{loading ? '正在更新…' : '刷新处理进度'}}</button>
    </view>
    <view v-if="loading && !detail.ticket" class="empty">正在加载…</view>
  </view>
</template>
<script setup>
import {ref} from 'vue'
import {onLoad,onShow,onPullDownRefresh} from '@dcloudio/uni-app'
import {faultRequest,statuses,faultLabel} from '../../components/js/fault-api.js'
import pageHeader from '../../components/page-header/index.vue'
const id=ref(''),detail=ref({}),loading=ref(false),confirming=ref(false),error=ref('')
const tips={NEW:'报修已收到，等待安排处理人',ASSIGNED:'已安排处理人，即将开始处理',PROCESSING:'工作人员正在排查与修复',RESOLVED:'工作人员已提交结果，请确认问题是否解决',CLOSED:'感谢反馈，本次工单已关闭'}
onLoad(options=>{id.value=options.id||''})
onShow(()=>load())
onPullDownRefresh(()=>load())
async function load(){
  if(loading.value || !id.value)return
  if(!uni.getStorageSync('token')){detail.value={};return uni.navigateTo({url:'/pages/user/login'})}
  loading.value=true;error.value=''
  try{detail.value=await faultRequest(id.value)}
  catch(e){error.value=e.message}
  finally{loading.value=false;uni.stopPullDownRefresh()}
}
function confirm(){
  if(confirming.value)return
  uni.showModal({title:'确认关闭',content:'确认设备故障已经解决？',success:async res=>{
    if(!res.confirm)return
    confirming.value=true
    try{detail.value=await faultRequest(id.value+'/confirm','POST');uni.showToast({title:'工单已关闭',icon:'success'})}
    catch(e){uni.showToast({title:e.message,icon:'none'});load()}
    finally{confirming.value=false}
  }})
}
</script>
<style scoped>
.action-pressed{opacity:.75}.confirm,.refresh{min-height:88rpx}.detail-page{padding-bottom:calc(36rpx + env(safe-area-inset-bottom))}
.detail-page{min-height:100vh;padding:30rpx;box-sizing:border-box;background:#f5f8f7}.state{padding:32rpx 24rpx;background:#e2f4eb;border-radius:22rpx;margin-bottom:24rpx}.status{display:block;font-size:40rpx;font-weight:700;color:#007b65}.subtitle{display:block;color:#568877;font-size:26rpx;margin-top:14rpx;line-height:1.6}.panel{background:white;border-radius:22rpx;padding:30rpx;margin-bottom:24rpx}.section-title{display:block;font-size:30rpx;font-weight:600;margin-bottom:24rpx}.field{display:flex;justify-content:space-between;font-size:25rpx;color:#809087;margin-top:20rpx}.field text{color:#344d43;max-width:70%;text-align:right}.description{display:block;margin-top:28rpx;line-height:1.7;font-size:28rpx;white-space:pre-wrap}.ticket-no{display:block;color:#9ba8a1;font-size:22rpx;margin-top:20rpx;word-break:break-all}.step{display:flex;position:relative;padding-bottom:30rpx}.dot{width:16rpx;height:16rpx;border-radius:50%;background:#008773;margin:10rpx 22rpx 0 0;flex-shrink:0}.step-body{border-bottom:1rpx solid #eff3f0;padding-bottom:22rpx;flex:1}.step-title{display:block;font-size:28rpx;font-weight:600}.note{display:block;font-size:26rpx;color:#6a7f74;margin:14rpx 0;line-height:1.6}.time{font-size:23rpx;color:#9aa89f}.confirm{background:#008773;color:white;font-size:28rpx;border-radius:16rpx}.refresh{background:white;color:#008773;margin-top:20rpx;font-size:28rpx}.empty{padding:60rpx 0;text-align:center;color:#809087}
</style>

