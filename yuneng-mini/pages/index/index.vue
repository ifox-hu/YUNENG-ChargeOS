<template>
	<view class="container b-home">
		<view class='header'>
			<navbar class='navbar' title='驭能智充' v-bind:showarrow='false'></navbar>
			<view class='b-welcome'>
				<text class='b-eyebrow'>附近补能 · 轻松出发</text>
				<text class='b-heading'>轻松充电，就在附近</text>
				<text class='b-description'>找到空闲端口，再放心出发</text>
				<view class='b-hero-bolt'><van-icon name='flash' size='36px' /></view>
			</view>
			<view class='b-section-heading'><text>附近充电站</text><text class='b-section-note'>选择适合你的站点</text></view>
			<van-row class="query">
				<van-col :span='20'>
					<van-row>
						<van-col :span='5' v-bind:class='query.sortType == 1 ? "active" : "default"'>
							<text v-on:click='setActive(1)'>距离最近</text>
						</van-col>
						<van-col :span='5' v-bind:class='query.sortType == 2 ? "active" : "default"'>
							<text v-on:click='setActive(2)'>价格最低</text>
						</van-col>
						<van-col :span='5' v-bind:class='query.sortType == 3 ? "active" : "default"'>
							<text v-on:click='setActive(3)'>智能排序</text>
						</van-col>
						<!-- <van-col :span='5' v-bind:class='active == 3 ? "active" : "default"'>
							<text v-on:click='setActive(3)'>常去场站</text>
						</van-col> -->
					</van-row>
				</van-col>
			</van-row>
		</view>
		<view class='content'>
			<view class='station' v-for='(item, index) in stations' v-bind:key='index' v-on:click='go("/pages/station/index?plotId=" + item.stationId + "&deviceType=" + item.deviceType + "&distance=" + item.distance)'>
				<view class='station-header'>
					<text class='station-title f-fwb'>{{item.stationName}}</text>
					<view class='plane'>
						<text class='distance'>{{item.distance / 1000}} km</text>
					</view>
				</view>
				<text v-if='item.address' class='b-station-address'>{{item.address}}</text>
				<view class='station-body'>
					<view class='fasts'>
						<view class='faster'>
							<view class='fast f-tac f-ib'>
							  <image src='../../static/image/fast.png' mode='widthFix'></image>
							</view>
							<view class='fast-info f-ib'>
								闲<text class='fast-num f-fwb'>{{item.fastToNoBusy}}</text>/{{item.fastNum}}
							</view>
						</view>
						<view class='faster'>
							<view class='fast f-tac f-ib'>
								<image src='../../static/image/slow.png' mode='widthFix'></image>
							</view>
							<view class='fast-info f-ib'>
								闲<text class='fast-num f-fwb'>{{item.slowToNoBusy}}</text>/{{item.slowNum}}
							</view>
						</view>
					</view>
					<view class='price f-tar'>
						¥ <text class='price-value f-fwb'>{{item.price}}</text>元/度 起
					</view>
				</view>
				<view class='station-footer'>
					<text class='park f-ib f-tac'>p</text>
					<text class='notice'>{{item.parkCarInfo}}</text>
				</view>
			</view>
			<text class='more f-tac f-db'>{{ moreText }}</text>
		</view>
	</view>
	<tabbar v-bind:active='0'></tabbar>
</template>

<style scoped lang="stylus">
	.container
		background-color white
		padding-bottom 120rpx
		padding-top 140rpx
	  .header
		  background-color white
		  padding 20rpx
		  margin-bottom 20rpx
		.banner
			width 100%
			margin-top 20rpx
			margin-bottom 16rpx	
		.active
			font-family 'scBold'
			font-weight bold
			color #2D55E8
		.default
			color #888888
		.search
			background url('../../static/image/dropdown.png') right no-repeat
			background-size 20%
			padding-right 30rpx
			position relative
			top -4rpx
			color #444
	  .filter-wrapper
			padding 20rpx
			.filter
				.filter-title
					margin-bottom 20rpx
				.filter-item
					margin-right 20rpx
			.filter
				margin-bottom 20rpx
		.content
			background-color #f6f6f6
			padding-top 10rpx
			padding-bottom 10rpx
		.station
			background-color white
			margin 20rpx 20rpx 0 20rpx
			border-radius 10rpx
			padding 20rpx
		.station-header 
			display flex
		.station-title
			font-size 32rpx
			flex 1
		.plane
			width 200rpx
			height 60rpx
			line-height 60rpx
			border 2rpx solid #DDD
			border-radius 40rpx
			text-align center
		.distance
			background url('../../static/image/plane.png') left no-repeat
			background-size 22%
			padding-left 44rpx
			color #333
			font-size 24rpx
		.station-body
			display flex
		.fasts
			.faster
				.fast
					font-weight bold
					color white
					width 44rpx
					height 44rpx
					line-height 44rpx
					background linear-gradient(96deg, #569AFF, #4A6EF3)
					border-radius 10rpx
					image
						width 28rpx
						height 28rpx
				.fast-info
					color #888888
					margin-left 20rpx
					.fast-num
						font-size 32rpx
						color #212121
			.faster
				margin-bottom 20rpx
		.fasts
			flex 1
		.price
			width 320rpx
			margin-top 20rpx
			color #F95731
		.price-value
			font-size 42rpx
			margin-left 4rpx
			margin-right 4rpx
		.park
			width 44rpx
			height 44rpx
			line-height 40rpx
			background #E9EDFF
			border-radius 10rpx
			font-weight bold
			color #4A6EF3
		.notice
			font-weight 400
			color #333333
			margin-left 20rpx
		.more
			margin-top 10rpx
			color #999
</style>

<script setup>
	import { ref, reactive, onMounted } from 'vue'
	import { onPullDownRefresh, onReachBottom, onLoad } from '@dcloudio/uni-app'
	import navbar from '../../components/navbar/index.vue'
	import tabbar from '../../components/tabbar/index.vue'
	import request from '../../components/js/request.js'
	
	const app = getApp()
	
	const go = (url) => {
		uni.navigateTo({
			url: url
		})
	}
	
	const setActive = (i) => {
		if (loading.value) return
		query.sortType = i
		index(1)
	}
	const query = reactive({
		deviceType: 4,
		lat: 39.9045035,
		lng: 116.408788,
		sortType: 1,
		distance: 100000000
	})
	const pager = reactive({
		pageNo: 1,
		pageSize: 5
	})
	
	const filtershow = ref(false)
	const showfilter = () => {
		filtershow.value = true
	}
	
	const stations = ref([])
	const index = (page) => {
		if (loading.value) return
		loading.value = true
		moreText.value = '加载中...'
		uni.getLocation({
			type: "gcj02",
			success: async (res) => {
				query.lat = res.latitude
				query.lng = res.longitude
			},
			complete: (res) => {
				request({
					url: 'charging/getPlotInfoPage',
					method: 'POST',
					data: { ...pager, ...query, pageNo: page },
					success: res => {
						if (res.data?.code !== 200 || !Array.isArray(res.data.data?.records)) {
							moreText.value = res.data?.msg || '站点加载失败，请下拉重试'
							return
						}
						const records = res.data.data.records
						stations.value = page === 1 ? records : stations.value.concat(records)
						pager.pageNo = page
						loadall.value = records.length < pager.pageSize || (res.data.data.total != null && stations.value.length >= res.data.data.total)
						moreText.value = stations.value.length === 0 ? '附近暂无充电站' : loadall.value ? '已显示全部站点' : '上滑加载更多~'
					},
					fail: () => { moreText.value = '网络异常，请下拉重试' },
					complete: () => { loading.value = false; uni.stopPullDownRefresh() }
				})
			}
		})
	}
	const loadall = ref(false)
	const loading = ref(false)
	const moreText = ref('上滑加载更多~')
	onPullDownRefresh(() => {
		loadall.value = false
		index(1)
	})
	onReachBottom(() => {
		if (!loadall.value && !loading.value) index(pager.pageNo + 1)
	})
	
	onLoad(() => {
		index(1)
	})
</script>
