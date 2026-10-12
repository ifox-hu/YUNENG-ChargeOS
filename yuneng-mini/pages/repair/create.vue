<template>
  <page-header title="设备报修" :confirm-leave="!!(form.pileId || form.description)" />
  <view class="repair-page">
    <view class="intro"><text class="title">设备出了什么问题？</text><text class="subtitle">提交故障后，可在「我的报修」追踪处理进度</text></view>
    <view class="panel">
      <view class="label">充电桩编号</view>
      <input class="input" v-model.trim="form.pileId" maxlength="64" placeholder="扫码识别或手动输入桩编号" />
      <button class="scan" hover-class="button-pressed" @click="scan">扫码识别设备</button>
      <view class="hint">找不到二维码？也可以输入设备上标注的桩编号。</view>
      <view class="label">故障类型</view>
      <view class="fault-options"><view v-for="(item,index) in faultTypes" :key="item.value" class="fault-option" :class="{'fault-selected':typeIndex===index}" hover-class="option-pressed" @click="typeIndex=index"><text>{{item.label}}</text><text v-if="typeIndex===index" class="selected-mark">✓</text></view></view>
      <view class="label">故障描述</view>
      <textarea class="description" v-model="form.description" maxlength="1000" placeholder="例如：插入充电枪后设备没有响应，指示灯不亮" />
      <view class="counter">{{form.description.length}} / 1000</view>
    </view>
    <view class="hint">同一设备、同类故障已有活动工单时，将合并报修并共享处理进度。</view>
    <button class="submit" hover-class="button-pressed" :loading="submitting" :disabled="submitting" @click="submit">{{submitting ? '正在提交…' : '提交报修'}}</button>
    <button class="link" hover-class="option-pressed" @click="goList">查看我的报修</button>
  </view>
</template>
<script setup>
import {ref,reactive} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {faultTypes,faultRequest} from '../../components/js/fault-api.js'
import pageHeader from '../../components/page-header/index.vue'
const form=reactive({pileId:'',description:''})
const typeIndex=ref(0),submitting=ref(false)
function goList(){uni.navigateTo({url:'/pages/repair/list'})}
onLoad(options=>{form.pileId=options.pileId || ''})
onShow(()=>{if(!uni.getStorageSync('token'))uni.navigateTo({url:'/pages/user/login'})})
function parsePile(result) {
  const raw=String(result||'').trim()
  // Accept a plain identifier or the existing charging QR's pileId/chargeNo query.
  const match=raw.match(/[?&](?:pileId|chargeNo|chargeId)=([^&#]+)/i)
  const id=match?decodeURIComponent(match[1]):raw
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw new Error('无法识别设备编号，请手动输入')
  return id
}
function scan(){
  uni.scanCode({onlyFromCamera:false,scanType:['qrCode'],
    success:res=>{try{form.pileId=parsePile(res.result)}catch(e){uni.showToast({title:e.message,icon:'none'})}},
    fail:()=>uni.showToast({title:'未完成扫码，可手动输入设备编号',icon:'none'})
  })
}
async function submit(){
  if(submitting.value)return
  if(!uni.getStorageSync('token'))return uni.navigateTo({url:'/pages/user/login'})
  if(!form.pileId || !form.description.trim())return uni.showToast({title:'请填写设备编号和故障描述',icon:'none'})
  submitting.value=true
  try {
    const result=await faultRequest('report','POST',{pileId:form.pileId,faultType:faultTypes[typeIndex.value].value,description:form.description.trim()})
    uni.showToast({title:result.merged?'已合并到现有工单':'报修提交成功',icon:'none'})
    uni.redirectTo({url:'/pages/repair/detail?id='+result.ticket.id})
  } catch(e){uni.showToast({title:e.message,icon:'none'})}finally{submitting.value=false}
}
</script>
<style scoped>
.fault-options{display:flex;flex-wrap:wrap;justify-content:space-between}.fault-option{width:48%;box-sizing:border-box;padding:24rpx 18rpx;min-height:88rpx;margin-bottom:16rpx;border:2rpx solid #e5ece8;border-radius:14rpx;font-size:26rpx;display:flex;align-items:center;justify-content:space-between}.fault-selected{color:#008773;background:#eaf7f0;border-color:#008773}.selected-mark{font-weight:700;margin-left:10rpx}.option-pressed{background:#e1f0e8}.button-pressed{opacity:.75}.link{background:transparent;border:0;min-height:88rpx;font-size:28rpx}.link::after{border:0}
.repair-page{min-height:100vh;background:#f5f8f7;padding:36rpx 30rpx;box-sizing:border-box}.intro{padding:10rpx 0 32rpx}.title{display:block;font-size:42rpx;font-weight:700;color:#123c33}.subtitle{display:block;font-size:26rpx;color:#7b8f89;margin-top:16rpx}.panel{padding:30rpx;background:white;border-radius:24rpx}.label{font-size:28rpx;font-weight:600;margin:24rpx 0 18rpx}.input{height:88rpx;line-height:88rpx;background:#f3f7f5;padding:0 22rpx;border-radius:12rpx;font-size:28rpx}.scan{margin:20rpx 0;color:#008773;background:#e6f5ef;font-size:28rpx}.hint{color:#7b8f89;font-size:24rpx;line-height:1.7;margin:24rpx 0}.description{width:100%;height:230rpx;box-sizing:border-box;padding:20rpx;background:#f3f7f5;border-radius:12rpx;font-size:28rpx}.counter{color:#95a29d;text-align:right;font-size:24rpx;margin-top:10rpx}.submit{background:#008773;color:#fff;border-radius:16rpx;font-size:30rpx;margin-top:24rpx}.link{display:block;text-align:center;color:#008773;margin:28rpx}.picker-arrow{float:right}
</style>
