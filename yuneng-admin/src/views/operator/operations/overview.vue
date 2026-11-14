<template>
  <div class="app-container overview-page">
    <div class="page-heading"><span>运营首页</span><el-tag size="small" type="info" effect="plain">{{ isPlatform ? '平台管理员' : '运营商账号' }}</el-tag></div>
    <div v-if="isPlatform" class="operator-toolbar">
      <div class="operator-picker"><span>运营商</span><el-select v-model="target" filterable size="small" class="operator-selector" :disabled="loading" @change="changeTenant"><el-option label="全部运营商" value="" /><el-option v-for="row in operators" :key="row.id" :label="row.name" :value="row.id" /></el-select><el-button v-if="target" size="small" plain icon="el-icon-back" @click="selectOperator('')">返回全部运营商</el-button></div>
    </div>
    <el-card shadow="never" class="filter-card">
      <el-radio-group v-model="period" size="small" @change="setPeriod"><el-radio-button :label="7">近7天</el-radio-button><el-radio-button :label="30">近30天</el-radio-button><el-radio-button :label="0">自定义</el-radio-button></el-radio-group>
      <el-date-picker v-model="range" type="daterange" value-format="yyyy-MM-dd" size="small" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="customRange" />
      <el-select v-if="!allOperators" v-model="station" clearable filterable placeholder="全部站点" size="small" @change="load"><el-option v-for="row in stations" :key="row.station_id" :value="row.station_id" :label="row.station_name" /></el-select>
      <el-button icon="el-icon-refresh" size="small" :loading="loading" @click="load">刷新</el-button>
    </el-card>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-state" />
    <div v-if="report" v-loading="loading">
      <div class="scope-heading"><strong>{{ allOperators ? '全部运营商' : selectedName }}</strong><span>{{ allOperators ? operators.length + ' 家运营商 · ' : '' }}{{ stations.length }} 个站点<el-tag v-if="isSample" size="mini" type="warning" effect="plain">展示样本</el-tag></span></div>
      <el-row :gutter="16" class="metric-row">
        <el-col v-for="metric in metrics" :key="metric.key" :xs="12" :lg="6"><el-card shadow="never" class="metric-card"><span class="metric-label">{{ metric.label }}</span><i :class="metric.icon" :style="{ color: metric.color }" /><div class="metric-value">{{ metric.key === 'orders' ? report.summary.orders : money(report.summary[metric.key]) }}<small>{{ metric.unit }}</small></div><span class="metric-caption">{{ metric.caption }}</span></el-card></el-col>
      </el-row>
      <el-card v-if="allOperators" shadow="never" class="section-card operator-list"><div slot="header"><strong>运营商经营情况</strong></div><el-table :data="report.operators" size="small" empty-text="暂无运营商"><el-table-column prop="name" label="运营商" min-width="180" /><el-table-column prop="stationCount" label="站点数" width="90" align="right" /><el-table-column prop="deviceCount" label="设备数" width="90" align="right" /><el-table-column prop="orders" label="订单数" width="100" align="right" /><el-table-column label="本地净收 / 元" min-width="140" align="right"><template slot-scope="scope">{{ money(scope.row.net) }}</template></el-table-column><el-table-column label="操作" width="100" align="center" fixed="right"><template slot-scope="scope"><el-button type="text" size="small" @click="selectOperator(scope.row.id)">查看详情</el-button></template></el-table-column></el-table></el-card>
      <el-row :gutter="16">
        <el-col :xs="24" :lg="16"><el-card shadow="never" class="section-card"><div slot="header"><strong>订单与净收趋势</strong><span class="subtle">金额与订单分轴展示</span></div><operation-chart v-if="report.trend.length" :option="trendOption" /><el-empty v-else description="当前日期范围暂无订单" :image-size="100" /></el-card></el-col>
        <el-col :xs="24" :lg="8"><el-card shadow="never" class="section-card"><div slot="header"><strong>设备运行状态</strong><span class="subtle">当前快照</span></div><operation-chart v-if="report.devices.length" :option="deviceOption" /><el-empty v-else description="暂无设备" :image-size="100" /></el-card></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :xs="24" :lg="14"><el-card shadow="never" class="section-card"><div slot="header"><strong>站点经营排行</strong></div><el-table :data="report.ranking" size="small" empty-text="暂无站点经营数据"><el-table-column type="index" label="排名" width="60" /><el-table-column prop="name" label="站点名称" /><el-table-column prop="orders" label="订单数" width="90" align="right" /><el-table-column label="本地净收 / 元" align="right"><template slot-scope="scope">{{ money(scope.row.net) }}</template></el-table-column></el-table></el-card></el-col>
        <el-col :xs="24" :lg="10"><el-card shadow="never" class="section-card"><div slot="header"><strong>待处理事项</strong><span class="subtle">{{ isSample ? '样本仅展示' : allOperators ? '选择运营商后处理' : '点击进入业务页' }}</span></div><button v-for="item in visiblePendingItems" :key="item.key" class="pending-item" :disabled="isSample || allOperators" @click="openPending(item)"><span><i :class="item.icon" /> {{ item.label }}</span><strong>{{ report.pending[item.key] }} <i class="el-icon-arrow-right" /></strong></button></el-card></el-col>
      </el-row>
      <p class="basis">{{ isSample ? '展示样本，不计入实际业务。' : '' }}{{ report.basis }}。优惠 {{ money(report.summary.discount) }} 元，累计退款 {{ money(report.summary.refunded) }} 元。</p>
    </div>
    <el-skeleton v-else-if="loading" :rows="10" animated />
    <el-empty v-else description="数据加载失败，请点击刷新重试" />
  </div>
</template>
<script>
import { dashboardSamples, getDashboardSample } from '@/demo/dashboard-samples'
import { loadOverviewOperators, mergeOperatorOverviews } from '@/utils/operations-overview'
import { listTenant } from '@/api/system/tenant'
import { getTenant } from '@/utils/auth'
import OperationChart from './chart'
import { getOperations, formatMoney } from '@/api/operator/operations'
function dateText(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
export default {
  name: 'OperationsOverview',
  components: { OperationChart },
  data() {
    const requested = String(this.$route.query.targetTenantId || '')
    const target = process.env.VUE_APP_DEMO === 'true' && !dashboardSamples.some(row => row.id === requested) ? '' : requested
    return {
      operators: [], target, report: null, stations: [], loading: false, error: '', period: 7, range: [], station: undefined, sequence: 0,
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
    isPlatform() { return Number(this.$store.getters.userId) === 1 },
    isSample() { return this.isPlatform && this.isDemo },
    allOperators() { return this.isPlatform && !this.target },
    selectedName() { const row = this.operators.find(row => row.id === this.target); const station = this.stations.find(row => row.station_id === this.station); return this.isPlatform ? row ? row.name : '运营商详情' : station ? station.station_name : '全部站点' },
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
    selectOperator(id) { this.target = String(id || ''); this.changeTenant() },
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
        const query = { from: this.range[0], to: this.range[1], stationId: this.station }
        const sample = this.isSample, platform = this.isPlatform, target = platform ? this.target : ''
        const operators = platform ? sample ? dashboardSamples.map(row => ({ id: row.id, name: row.name })) : await loadOverviewOperators(listTenant) : []
        // 兼容本地既有 9999 演示身份：它允许没有 sys_tenant 行，但已有站点仍应可查。
        if (platform && !sample && !this.isDemo && String(getTenant()) === '9999' && !operators.some(row => row.id === '9999')) operators.push({ id: '9999', name: '本地演示运营商（9999）' })
        if (target && !operators.some(row => row.id === target)) throw new Error('运营商不存在或无权查看')
        const fetchReport = async id => sample ? getDashboardSample(id, query) : (await getOperations('overview', { ...query, targetTenantId: id || undefined })).data
        let data
        if (platform && !target) {
          const entries = []
          // 限制并发，任一运营商查询失败时不展示不完整的平台合计。
          for (let offset = 0; offset < operators.length; offset += 4) entries.push(...await Promise.all(operators.slice(offset, offset + 4).map(async row => ({ ...row, report: await fetchReport(row.id) }))))
          data = mergeOperatorOverviews(entries)
        } else data = await fetchReport(target)
        if (sequence !== this.sequence) return
        this.operators = operators; this.report = data; this.stations = data.stations
      } catch (error) { if (sequence === this.sequence) { this.report = null; this.error = error.message || '经营数据加载失败，请检查后端服务或点击刷新重试' } } finally { if (sequence === this.sequence) this.loading = false }
    },
    openPending(item) { if (this.isSample || this.allOperators) return; this.$router.push({ path: item.path, query: { ...item.query, targetTenantId: this.isPlatform ? this.target : undefined }}) }
  }
}
</script>
<style scoped>
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; color: #303133; font-size: 16px; }
.operator-toolbar,.operator-picker { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.operator-toolbar { justify-content: space-between; margin-bottom: 16px; }
.operator-picker > span { font-size: 14px; color: #606266; }
.operator-selector { width: 280px; max-width: 100%; }
.scope-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0 16px; color: #303133; }
.scope-heading > span { color: #7c8ba1; font-size: 13px; }
.scope-heading .el-tag { margin-left: 10px; }
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
@media(max-width: 900px) { .filter-card .el-date-editor,.filter-card .el-select { margin: 10px 0; max-width: 100%; } .operator-picker { width: 100%; } .operator-selector { width: 240px; } .scope-heading { flex-wrap: wrap; } }
</style>
