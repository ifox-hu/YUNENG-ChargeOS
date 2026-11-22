<template>
  <page-header title="我的报修" />
  <view class="repair-list">
    <view class="top"><view><text class="title">报修记录</text><text class="list-caption">从提交到解决，进度一目了然</text></view><button hover-class="card-pressed" @click="goCreate">＋ 报修</button></view>
    <view v-if="error" class="empty"><text>{{error}}</text><button size="mini" @click="load(true)">重试</button></view>
    <view v-else-if="!loading && !rows.length" class="empty"><view class="empty-mark">✓</view><text class="empty-title">暂时没有报修记录</text><text class="empty-caption">遇到设备故障？提交报修，我们会跟进处理。</text><button class="empty-action" hover-class="card-pressed" @click="goCreate">提交第一条报修</button></view>
    <view v-for="row in rows" :key="row.id" class="card" hover-class="card-pressed" @click="goDetail(row.id)">
      <view class="row"><text class="name">{{row.pileName || row.pileId}}</text><text class="badge">{{statuses[row.status]}}</text></view>
      <text class="muted">设备编号 {{row.pileId}}</text>
      <text class="fault">{{faultLabel(row.faultType)}}</text>
      <text class="description">{{row.description}}</text>
      <view class="bottom"><text>{{row.createdAt}}</text><text>查看进度 ›</text></view>
    </view>
    <button v-if="rows.length<total && !error" :loading="loading" :disabled="loading" @click="load(false)">加载更多</button>
    <view v-if="loading" class="empty">正在加载…</view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { faultRequest, statuses, faultLabel } from '../../components/js/fault-api.js'
import pageHeader from '../../components/page-header/index.vue'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')

function goCreate() {
  uni.navigateTo({ url: '/pages/repair/create' })
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/repair/detail?id=${id}` })
}

async function load(reset) {
  if (loading.value) return
  if (!uni.getStorageSync('token')) {
    rows.value = []
    total.value = 0
    return uni.navigateTo({ url: '/pages/user/login' })
  }
  loading.value = true
  error.value = ''
  const next = reset ? 1 : page.value + 1
  try {
    const data = await faultRequest('mine', 'GET', { pageNum: next, pageSize: 10 })
    rows.value = reset ? data.records : rows.value.concat(data.records)
    total.value = data.total
    page.value = next
  } catch (failure) {
    error.value = failure.message
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => load(true))
onPullDownRefresh(() => load(true))
</script>
<style scoped>
.list-caption{display:block;font-size:23rpx;color:#818895;margin-top:12rpx}.top button{height:88rpx;line-height:88rpx;font-size:26rpx;padding:0 22rpx;flex-shrink:0}.card-pressed{background:#e7ecf4!important}.empty-mark{width:100rpx;height:100rpx;line-height:100rpx;border-radius:30rpx;background:#e5eaf2;color:#2563eb;font-size:46rpx;margin:12rpx auto 26rpx}.empty-title{display:block;font-size:30rpx;font-weight:600;color:#364256}.empty-caption{display:block;font-size:25rpx;line-height:1.8;margin:16rpx 0 30rpx}.empty-action{font-size:27rpx;color:#2563eb;background:#e5eaf2;min-height:88rpx}.empty-action::after{border:0}
.repair-list{min-height:100vh;background:#f3f6fc;padding:30rpx;box-sizing:border-box}.top,.row,.bottom{display:flex;justify-content:space-between;align-items:center}.top{margin-bottom:30rpx}.title{font-size:38rpx;font-weight:700;color:#193253}.top button{margin:0;color:#2563eb;background:#e4eaf3}.card{padding:30rpx;margin-bottom:24rpx;background:#fff;border-radius:22rpx}.name{font-size:30rpx;font-weight:600}.badge{padding:8rpx 14rpx;font-size:24rpx;background:#e6ecf5;color:#2563eb;border-radius:8rpx}.muted{display:block;font-size:24rpx;color:#8b9099;margin-top:16rpx}.fault{display:block;margin-top:24rpx;font-size:28rpx}.description{display:block;font-size:26rpx;color:#6b717c;margin-top:14rpx;line-height:1.6}.bottom{border-top:1rpx solid #edf2ef;padding-top:20rpx;margin-top:24rpx;font-size:23rpx;color:#8b9099}.bottom text:last-child{color:#2563eb}.empty{text-align:center;color:#7b828f;line-height:1.8;padding:60rpx 0;font-size:28rpx}
</style>
