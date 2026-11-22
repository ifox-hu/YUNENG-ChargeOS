<template><view class="page"><page-header title="积分中心"/><view class="card hero"><text class="label">当前积分</text><text class="score">{{score}}</text><text class="hint">每日签到 +5 分，完成充电订单按实付金额取整奖励</text></view><view class="actions"><button class="action" :disabled="signing||signed" @click="sign">{{signed?'今日已签到':'每日签到 +5'}}</button><button class="action secondary" @click="load">刷新</button></view><view class="card"><view class="title">可领取订单奖励</view><view v-if="!orders.length" class="empty">暂无可领取的完成订单</view><view v-for="o in orders" :key="o.order_id" class="order"><view><text class="order-id">订单 {{o.order_number||o.order_id}}</text><text class="row-time">金额 ¥{{Number(o.ordergold||0).toFixed(2)}}</text></view><button class="claim" :disabled="claiming" @click="claim(o.order_id)">领取</button></view></view><view class="card"><view class="title">积分明细</view><view v-if="!ledger.length" class="empty">暂无积分流水</view><view v-for="row in ledger" :key="row.business_key" class="row"><view><text class="row-title">{{row.remark||'积分变动'}}</text><text class="row-time">{{row.create_time}}</text></view><text class="points">+{{row.points}}</text></view></view></view></template>
<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import pageHeader from '../../components/page-header/index.vue'
import request from '../../components/js/request.js'

const score = ref(0)
const signed = ref(false)
const signing = ref(false)
const claiming = ref(false)
const orders = ref([])
const ledger = ref([])
const shanghaiOffsetMs = 8 * 60 * 60 * 1000

function load() {
  request({
    url: 'points/summary',
    success: ({ data }) => {
      if (data?.code === 200) score.value = Number(data.data?.credit || 0)
    }
  })
  request({
    url: 'points/ledger',
    data: { page: 1, pageSize: 30 },
    success: ({ data }) => {
      if (data?.code !== 200) return
      ledger.value = data.data || []
      // The server generates SIGN keys from the Asia/Shanghai calendar date.
      const today = new Date(Date.now() + shanghaiOffsetMs).toISOString().slice(0, 10)
      signed.value = ledger.value.some(row => row.type === 'DAILY_SIGN' && row.business_key === `SIGN:${today}`)
    }
  })
  request({
    url: 'points/orders',
    success: ({ data }) => {
      if (data?.code === 200) orders.value = data.data || []
    }
  })
}

function sign() {
  if (signing.value || signed.value) return
  signing.value = true
  request({
    url: 'points/sign',
    method: 'POST',
    success: ({ data }) => {
      if (data?.code !== 200) {
        uni.showToast({ title: data?.msg || '签到失败', icon: 'none' })
        return
      }
      signed.value = true
      uni.showToast({ title: '签到成功 +5', icon: 'success' })
      load()
    },
    complete: () => { signing.value = false }
  })
}

function claim(id) {
  if (claiming.value) return
  claiming.value = true
  request({
    url: `points/orders/${encodeURIComponent(id)}/claim`,
    method: 'POST',
    success: ({ data }) => {
      if (data?.code !== 200) {
        uni.showToast({ title: data?.msg || '领取失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '领取成功', icon: 'success' })
      load()
    },
    complete: () => { claiming.value = false }
  })
}

onShow(() => {
  if (uni.getStorageSync('token')) load()
})
</script>
<style scoped>.page{min-height:100vh;background:#f3f6fc;padding-bottom:40rpx}.card{margin:22rpx 28rpx;background:#fff;border-radius:24rpx;padding:28rpx}.hero{background:linear-gradient(135deg,#5267a7,#758ac4);color:#fff}.label{display:block;font-size:25rpx;opacity:.85}.score{display:block;font-size:70rpx;font-weight:700;margin:14rpx 0}.hint{font-size:22rpx;opacity:.85}.actions{display:flex;gap:18rpx;margin:22rpx 28rpx}.action{flex:1;background:#2563eb;color:#fff;border-radius:14rpx;font-size:27rpx}.action::after,.claim::after{border:0}.action.secondary{background:#fff;color:#2563eb;border:1rpx solid #b9c6dd}.title{font-size:30rpx;font-weight:700}.order,.row{display:flex;justify-content:space-between;align-items:center;padding:22rpx 0;border-bottom:1rpx solid #edf2ef}.order:last-child,.row:last-child{border:0}.order-id,.row-title{display:block;font-size:26rpx}.row-time{display:block;color:#8a909b;font-size:22rpx;margin-top:6rpx}.claim{background:#e1e8f4;color:#2563eb;font-size:24rpx;border-radius:12rpx;padding:8rpx 22rpx}.points{color:#2563eb;font-size:30rpx;font-weight:700}.empty{text-align:center;color:#9aa0ab;padding:40rpx 0;font-size:24rpx}</style>
