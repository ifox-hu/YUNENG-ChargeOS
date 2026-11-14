<template>
  <div class="app-container overview-page">
    <div class="page-heading"><span>运营首页</span><el-tag size="small" type="info" effect="plain">{{ sampleId ? '示例运营商 · 非实际业务' : isDemo ? '浏览器模拟数据' : '本地后端数据' }}</el-tag></div>
    <p class="home-purpose">首页查看经营概览和待办；站点、设备明细及统计导出请进入“经营管理”。</p>
    <operation-scope v-model="target" :samples="sampleOperators" :sample-id="sampleId" note="经营概览与待办速览；实际数据与示例预览分别展示" @sample-change="changeSample" @change="changeTenant" />
    <el-alert v-if="sampleId" :title="report ? report.sampleName + '：当前显示展示样本，待办不可操作' : '正在加载示例'" type="info" :closable="false" show-icon class="sample-notice" />
    <el-card shadow="never" class="filter-card">
      <el-radio-group v-model="period" size="small" @change="setPeriod"><el-radio-button :label="7">近7天</el-radio-button><el-radio-button :label="30">近30天</el-radio-button><el-radio-button :label="0">自定义</el-radio-button></el-radio-group>
      <el-date-picker v-model="range" type="daterange" value-format="yyyy-MM-dd" size="small" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="customRange" />
      <el-select v-model="station" clearable filterable placeholder="全部站点" size="small" @change="load"><el-option v-for="row in stations" :key="row.station_id" :value="row.station_id" :label="row.station_name" /></el-select>
      <el-button icon="el-icon-refresh" size="small" :loading="loading" @click="load">刷新</el-button>
    </el-card>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-state" />
    <div v-if="report" v-loading="loading">
      <el-row :gutter="16" class="metric-row">
        <el-col v-for="metric in metrics" :key="metric.key" :xs="12" :lg="6"><el-card shadow="never" class="metric-card"><span class="metric-label">{{ metric.label }}</span><i :class="metric.icon" :style="{ color: metric.color }" /><div class="metric-value">{{ metric.key === 'orders' ? report.summary.orders : money(report.summary[metric.key]) }}<small>{{ metric.unit }}</small></div><span class="metric-caption">{{ metric.caption }}</span></el-card></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :xs="24" :lg="16"><el-card shadow="never" class="section-card"><div slot="header"><strong>订单与净收趋势</strong><span class="subtle">金额与订单分轴展示</span></div><operation-chart v-if="report.trend.length" :option="trendOption" /><el-empty v-else description="当前日期范围暂无订单" :image-size="100" /></el-card></el-col>
        <el-col :xs="24" :lg="8"><el-card shadow="never" class="section-card"><div slot="header"><strong>设备运行状态</strong><span class="subtle">当前快照</span></div><operation-chart v-if="report.devices.length" :option="deviceOption" /><el-empty v-else description="暂无设备" :image-size="100" /></el-card></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :xs="24" :lg="14"><el-card shadow="never" class="section-card"><div slot="header"><strong>站点经营排行</strong></div><el-table :data="report.ranking" size="small" empty-text="暂无站点经营数据"><el-table-column type="index" label="排名" width="60" /><el-table-column prop="name" label="站点名称" /><el-table-column prop="orders" label="订单数" width="90" align="right" /><el-table-column label="本地净收 / 元" align="right"><template slot-scope="scope">{{ money(scope.row.net) }}</template></el-table-column></el-table></el-card></el-col>
        <el-col :xs="24" :lg="10"><el-card shadow="never" class="section-card"><div slot="header"><strong>待处理事项</strong><span class="subtle">{{ sampleId ? '样本仅展示，切回实际数据后处理' : '点击进入业务页' }}</span></div><button v-for="item in visiblePendingItems" :key="item.key" class="pending-item" :disabled="Boolean(sampleId)" @click="openPending(item)"><span><i :class="item.icon" /> {{ item.label }}</span><strong>{{ report.pending[item.key] }} <i class="el-icon-arrow-right" /></strong></button></el-card></el-col>
      </el-row>
      <p class="basis">{{ report.basis }}。优惠 {{ money(report.summary.discount) }} 元，累计退款 {{ money(report.summary.refunded) }} 元。</p>
    </div>
    <el-skeleton v-else-if="loading" :rows="10" animated />
    <el-empty v-else description="数据加载失败，请点击刷新重试" />
  </div>
</template>
<script>
import OperationScope from './scope'
import { dashboardSamples, getDashboardSample } from '@/demo/dashboard-samples'
import OperationChart from './chart'
import { getOperations, formatMoney } from '@/api/operator/operations'
function dateText(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
export default {
  name: 'OperationsOverview',
  components: { OperationScope, OperationChart },
  data() {
    return {
      sampleId: '', sampleOperators: dashboardSamples, target: this.$route.query.targetTenantId || '', report: null, stations: [], loading: false, error: '', period: 7, range: [], station: undefined, sequence: 0,
      metrics: [
        { key: 'gross', label: '订单结算金额', caption: '已结束订单费用，不代表已收款', unit: '元', icon: 'el-icon-tickets', color: '#2563eb' },
        { key: 'net', label: '本地实收净额', caption: '余额实付扣除累计退款', unit: '元', icon: 'el-icon-wallet', color: '#1ab394' },
        { key: 'power', label: '累计充电量', caption: '来自模拟充电订单', unit: 'kWh', icon: 'el-icon-lightning', color: '#e6a23c' },
        { key: 'orders', label: '订单数量', caption: '当前筛选范围内全部订单', unit: '笔', icon: 'el-icon-document', color: '#4f9bea' }
      ],
      pendingItems: [
        { key: 'exceptions', label: '异常订单待核查', icon: 'el-icon-warning-outline', path: '/operate/order', query: { tab: 'exceptions', exceptions: 'true' }},
        { key: 'faults', label: '未关闭故障工单', icon: 'el-icon-set-up', path: '/operate/fault', query: { status: 'ACTIVE' }},
        { key: 'points', label: '积分发放失败事件', icon: 'el-icon-present', path: '/operate/order', query: { pointsMonitor: 'true' }}
      ]
    }
  },
  computed: {
    visiblePendingItems() { const permissions = this.$store.getters.permissions || []; const root = permissions.includes('*:*:*'); return this.pendingItems.filter(item => item.key === 'points' ? !this.isDemo && Number(this.$store.state.user.id) === 1 : root || permissions.includes(item.key === 'faults' ? 'operator:fault:list' : 'operator:operations:orders')) },
    isDemo() { return process.env.VUE_APP_DEMO === 'true' },
    trendOption() {
      const rows = this.report.trend
      return { color: ['#2563eb', '#1ab394'], tooltip: { trigger: 'axis' }, legend: { data: ['本地净收 / 元', '订单 / 笔'] }, grid: { left: 48, right: 42, top: 48, bottom: 35 }, xAxis: { type: 'category', data: rows.map(row => row.day.slice(5)), boundaryGap: false }, yAxis: [{ type: 'value', name: '元' }, { type: 'value', name: '笔', minInterval: 1 }], series: [{ name: '本地净收 / 元', type: 'line', smooth: true, areaStyle: { opacity: 0.08 }, data: rows.map(row => row.net) }, { name: '订单 / 笔', type: 'line', yAxisIndex: 1, data: rows.map(row => row.orders) }] }
    },
    deviceOption() {
      return { color: ['#1ab394', '#aab4c7', '#e6a23c'], tooltip: { trigger: 'item' }, legend: { bottom: 0 }, series: [{ type: 'pie', radius: ['48%', '70%'], center: ['50%', '45%'], label: { formatter: '{b}\n{c} 台' }, data: this.report.devices.map(row => ({ name: String(row.status) === '0' ? '在线' : String(row.status) === '1' ? '离线' : '状态未确认', value: row.count })) }] }
    }
  },
  created() { this.setPeriod() },
  methods: {
    money: formatMoney,
    changeSample(id) { this.sampleId = id; this.changeTenant() },
    changeTenant() { this.station = undefined; this.stations = []; this.report = null; this.load() },
    setPeriod() {
      if (!this.period) return
      const end = new Date(); const start = new Date(); start.setDate(end.getDate() - this.period + 1)
      this.range = [dateText(start), dateText(end)]; this.load()
    },
    customRange() { this.period = 0; this.load() },
    async load() {
      if (!this.range || this.range.length !== 2) return this.$message.warning('请选择日期范围')
      const sequence = ++this.sequence
      this.loading = true; this.error = ''
      try {
        const query = { targetTenantId: this.target || undefined, from: this.range[0], to: this.range[1], stationId: this.station }
        const { data } = this.sampleId ? { data: getDashboardSample(this.sampleId, query) } : await getOperations('overview', query)
        if (sequence !== this.sequence) return
        this.report = data; this.stations = data.stations
      } catch (error) { if (sequence === this.sequence) { this.report = null; this.error = '经营数据加载失败，请检查后端服务或点击刷新重试' } } finally { if (sequence === this.sequence) this.loading = false }
    },
    openPending(item) { if (this.sampleId) return; this.$router.push({ path: item.path, query: { ...item.query, targetTenantId: this.target || this.report.tenantId }}) }
  }
}
</script>
<style scoped>
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; color: #303133; font-size: 16px; }
.home-purpose { margin: -4px 0 16px; color: #7c8ba1; font-size: 13px; line-height: 1.6; }
.sample-notice { margin-bottom: 16px; }
.pending-item:disabled { cursor: default; }
.filter-card { margin-bottom: 16px; }
.filter-card .el-date-editor,.filter-card .el-select,.filter-card .el-button { margin-left: 12px; }
.metric-card { margin-bottom: 16px; }
.metric-card i { float: right; font-size: 22px; }
.metric-label { color: #606266; font-size: 14px; }
.metric-value { font-size: 24px; color: #303133; margin: 16px 0 10px; }
.metric-value small { font-size: 12px; margin-left: 7px; color: #909399; }
.metric-caption,.basis { font-size: 12px; color: #909399; }
.section-card { margin-bottom: 16px; }
.subtle { float: right; font-size: 12px; color: #909399; }
.pending-item { display: flex; width: 100%; padding: 16px 0; border: 0; background: white; border-bottom: 1px solid #ebeef5; color: #606266; justify-content: space-between; cursor: pointer; }
.pending-item strong { color: #13ce66; }
.pending-item:hover { background: #f5f7fa; }
.error-state { margin-bottom: 16px; }
@media(max-width: 900px) { .filter-card .el-date-editor,.filter-card .el-select { margin: 10px 0; max-width: 100%; } }
</style>
