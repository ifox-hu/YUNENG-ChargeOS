<template>
  <div v-loading="loading" class="distribution-page">
    <header><div><h1>桩分布</h1><p>查看站点所在区域与地理位置</p></div><el-button size="small" icon="el-icon-refresh" :loading="loading" @click="load">刷新站点</el-button></header>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-alert v-if="$route.query.tenantId || $route.query.stationId" title="已沿用仪表盘的站点范围" type="info" :closable="false"><el-button type="text" @click="$router.replace({path:'/operations/map',query:{}})">查看全部可见站点</el-button></el-alert>
    <el-alert v-if="missingCoordinates" :title="missingCoordinates + ' 个站点未录入有效坐标，已按所属地区计入省级统计；补录后可显示精确点位。'" type="info" show-icon :closable="false" />
    <el-alert v-if="demoLocations" :title="demoLocations + ' 个演示站点已显示示意位置，仅用于功能展示，不代表真实设备定位。'" type="info" show-icon :closable="false" />
    <div class="map-workspace">
      <aside>
        <div class="station-search"><el-input v-model="keyword" clearable placeholder="搜索站点名称或地址" prefix-icon="el-icon-search" /><div class="list-heading"><strong>站点列表 · {{ filteredStations.length }}</strong><el-button v-if="region" type="text" @click="region=null">清除{{ region.name }}筛选</el-button></div></div>
        <div class="station-list"><button v-for="station in filteredStations" :key="station.stationId" class="station-item" @click="selected=station"><i class="el-icon-location-outline" /><div><strong>{{ station.stationName }}</strong><span>{{ station.address || '地址未填写' }}</span><small>{{ position(station) ? (station.coordinateSource === 'DEMO' ? '演示示意位置（非真实定位）' : '已录入坐标') : '待补录坐标' }}</small></div><i class="el-icon-arrow-right" /></button><el-empty v-if="!filteredStations.length&&!loading" description="暂无匹配站点" :image-size="70" /></div>
      </aside>
      <section class="map-panel"><div class="map-tools"><el-tag effect="plain">{{ region ? region.name : '全国' }}</el-tag><span>已加载 {{ scopedStations.length }} 个站点 · 可拖动、缩放 · 点击省份筛选</span><el-button v-if="region" size="mini" @click="region=null">返回全国</el-button></div><station-map :stations="filteredStations" @select="selected=$event" @region="region=$event" /></section>
    </div>
    <el-dialog title="站点详情" :visible.sync="detailVisible" width="min(520px, 94vw)">
      <el-descriptions v-if="selected" :column="1" border><el-descriptions-item label="站点名称">{{ selected.stationName }}</el-descriptions-item><el-descriptions-item label="地址">{{ selected.address || '未填写' }}</el-descriptions-item><el-descriptions-item label="地区代码">{{ selected.regionCode || '未填写' }}</el-descriptions-item><el-descriptions-item label="经纬度">{{ position(selected) ? position(selected).join(', ') : '未录入有效坐标' }}</el-descriptions-item><el-descriptions-item v-if="selected.coordinateSource === 'DEMO'" label="定位说明">演示示意位置，非真实设备定位</el-descriptions-item></el-descriptions>
      <span slot="footer"><el-button @click="selected=null">关闭</el-button><el-button type="primary" @click="$router.push('/operate/station')">进入站点管理</el-button></span>
    </el-dialog>
  </div>
</template>

<script>
import StationMap from './StationMap'
import { stationPosition } from './data'
import request from '@/utils/request'
export default {
  name: 'OperationsMap',
  components: { StationMap },
  data() { return { stations: [], keyword: '', region: null, selected: null, loading: false, error: '' } },
  computed: {
    scopedStations() { const q = this.$route.query; return this.stations.filter(s => (!q.tenantId || String(s.tenantId) === String(q.tenantId)) && (!q.stationId || String(s.stationId) === String(q.stationId))) },
    filteredStations() {
      const keyword = this.keyword.trim().toLowerCase()
      return this.scopedStations.filter(station => (!this.region || String(station.regionCode || '').slice(0, 2) === this.region.prefix || station.province === this.region.name) && (!keyword || [station.stationName, station.address].some(value => String(value || '').toLowerCase().includes(keyword))))
    },
    missingCoordinates() { return this.scopedStations.filter(station => !stationPosition(station)).length },
    demoLocations() { return this.scopedStations.filter(station => station.coordinateSource === 'DEMO' && stationPosition(station)).length },
    detailVisible: { get() { return !!this.selected }, set(value) { if (!value) this.selected = null } }
  },
  created() { this.load() },
  watch: { '$route.query'() { this.region = null; this.selected = null; this.keyword = ''; this.load() } },
  methods: {
    position: stationPosition,
    async load() {
      const sequence = this.loadSequence = (this.loadSequence || 0) + 1
      this.loading = true
      this.error = ''
      try {
        const { tenantId, stationId } = this.$route.query
        const { data } = await request({ url: '/operator/overview', method: 'get', params: { tenantId, stationId }})
        if (sequence !== this.loadSequence || this._isDestroyed) return
        this.stations = data.stations || []
      } catch (error) { if (sequence === this.loadSequence) { this.stations = []; this.error = '站点加载失败，请检查站点查看权限或网络后重试。' } } finally { if (sequence === this.loadSequence) this.loading = false }
    }
  }
}
</script>

<style scoped>
.distribution-page { padding: 24px; color: #263650; background: #f4f7fc; min-height: calc(100vh - 84px); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }h1 { font-size: 25px; margin: 0 0 8px; }header p { font-size: 13px; color: #8695ac; margin: 0; }.el-alert { margin-bottom: 12px; }
.map-workspace { display: grid; grid-template-columns: 290px minmax(0,1fr); height: max(580px,calc(100vh - 265px)); border: 1px solid #e3eaf4; border-radius: 12px; overflow: hidden; background: #fff; }aside { border-right: 1px solid #e7edf6; display: flex; flex-direction: column; min-height: 0; }.station-search { padding: 18px 15px 0; }.list-heading { display: flex; justify-content: space-between; align-items: center; min-height: 48px; font-size: 13px; }.station-list { overflow: auto; flex: 1; }.station-item { display: flex; gap: 10px; align-items: flex-start; width: 100%; background: white; border: none; border-top: 1px solid #eef2f7; padding: 18px 14px; text-align: left; color: #36516f; cursor: pointer; }.station-item:hover { background: #f2f7ff; }.station-item > i:first-child { color: #3779ef; font-size: 21px; }.station-item > i:last-child { margin-left: auto; margin-top: 4px; color: #9aabc0; }.station-item strong,.station-item span,.station-item small { display: block; }.station-item strong { line-height: 1.5; font-size: 13px; }.station-item span { font-size: 12px; margin-top: 6px; color: #8293aa; }.station-item small { font-size: 11px; color: #a3afbd; margin-top: 8px; }.map-panel { display: flex; flex-direction: column; min-height: 0; background: linear-gradient(160deg,#f8fbff,#eaf2fc); }.map-tools { display: flex; align-items: center; gap: 12px; padding: 16px; z-index: 1; }.map-tools > span:last-of-type { font-size: 12px; color: #8496b0; }.map-panel > .station-map-wrap { flex: 1; height: 0; }
@media(max-width:900px) { .map-workspace { grid-template-columns: 1fr; height: auto; }.map-panel { min-height: 440px; grid-row: 1; }aside { max-height: 350px; }.distribution-page { padding: 14px; }.map-tools { flex-wrap: wrap; } }
</style>
