<template>
  <view class="page-header" :style="{paddingTop:statusHeight+'px'}">
    <view class="navigation" :style="{height:navHeight+'px'}">
      <button class="back-button" hover-class="back-pressed" aria-label="返回上一页" @click="back">
        <view class="back-chevron"></view><text>返回</text>
      </button>
      <text class="navigation-title" :style="{left:titleInset+'px',right:titleInset+'px'}">{{title}}</text>
    </view>
  </view>
</template>
<script setup>
const props=defineProps({title:String,fallback:{type:String,default:'/pages/user/index'},confirmLeave:Boolean})
let statusHeight=20,navHeight=44,titleInset=100
try {
  const info=typeof uni.getWindowInfo==='function'?uni.getWindowInfo():uni.getSystemInfoSync()
  statusHeight=info.statusBarHeight || 20
  const capsule=typeof uni.getMenuButtonBoundingClientRect==='function'?uni.getMenuButtonBoundingClientRect():null
  if(capsule && capsule.height>0 && capsule.top>=statusHeight) {
    navHeight=Math.max(44,(capsule.top-statusHeight)*2+capsule.height)
    titleInset=Math.max(88,(info.windowWidth || 375)-capsule.left+8)
  }
} catch(e) { /* Use a safe navigation height outside WeChat. */ }
function navigateBack(){
  const fallback=()=>uni.reLaunch({url:props.fallback})
  if(getCurrentPages().length>1)uni.navigateBack({delta:1,fail:fallback})
  else fallback()
}
function back(){
  if(props.confirmLeave)uni.showModal({title:'离开报修页面？',content:'当前填写的内容尚未提交，离开后不会保存。',confirmText:'离开',cancelText:'继续填写',success:res=>{if(res.confirm)navigateBack()}})
  else navigateBack()
}
</script>
<style scoped>
.page-header{position:sticky;top:0;background:#f3f7f5;z-index:20;box-sizing:border-box}
.navigation{position:relative;display:flex;align-items:center}
.back-button{display:flex;align-items:center;justify-content:center;gap:12rpx;width:154rpx;height:88rpx;line-height:1;margin:0 0 0 12rpx;padding:0;background:transparent;color:#24463b;font-size:27rpx;border-radius:14rpx;flex-shrink:0}
.back-button::after{border:0}.back-pressed{background:#dfede6}
.back-chevron{width:16rpx;height:16rpx;border-left:3rpx solid #24463b;border-bottom:3rpx solid #24463b;transform:rotate(45deg)}
.navigation-title{position:absolute;text-align:center;font-size:32rpx;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
</style>
