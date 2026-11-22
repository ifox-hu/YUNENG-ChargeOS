<template>
  <div v-loading="loading" class="operations-dashboard">
    <header class="page-heading">
      <h1>仪表盘</h1>
      <div class="heading-actions">
        <span v-if="updatedAt" class="update-time">更新于 {{ updatedAt }}</span>
        <el-button icon="el-icon-refresh" size="small" :loading="loading" @click="refreshOverview">刷新</el-button>
      </div>
    </header>
    <scope-selector :scope="scope" :operators="operators" :stations="stationOptions" compact @change="changeScope">
      <div class="dashboard-period"><el-radio-group class="period-presets" :value="periodPreset" size="small" aria-label="统计日期" @input="choosePeriod">
        <el-radio-button v-for="item in presets" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button>
        <el-radio-button label="custom" @click.native="openCustomDates">自定义</el-radio-button>
      </el-radio-group><el-date-picker
        ref="periodPicker"
        :value="selectedDates"
        popper-class="dashboard-date-picker"
        type="daterange"
        value-format="yyyy-MM-dd"
        size="small"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :clearable="false"
        unlink-panels
        @input="applyDates"
      /></div>
    </scope-selector>
    <el-alert v-for="failure in failures" :key="failure" :title="failure" type="warning" :closable="false" show-icon class="data-warning" />
    <section v-if="selectedStation" class="station-detail"><div><el-button type="text" icon="el-icon-back" @click="changeScope({tenantId:scope.tenantId})">返回全部站点</el-button><h2>{{ selectedStation.stationName }}</h2><span>{{ selectedStation.address || '地址待录入' }}</span></div><el-button type="text" @click="stationDetailVisible=true">查看站点详情 <i class="el-icon-arrow-right" /></el-button></section>
    <div class="metric-grid"><section v-for="card in cards" :key="card.label" class="metric-card"><div class="metric-label"><span>{{ card.label }}<small v-if="card.note" class="metric-definition">{{ card.note }}</small></span><i :class="card.icon" /></div><div class="metric-value"><strong>{{ metric(card.value,card.digits) }}</strong><span>{{ card.unit }}</span></div><div v-if="card.key" class="metric-comparison" :class="comparisonFor(card).direction" :title="comparisonPeriod">{{ comparisonFor(card).text }}</div></section></div>
    <quick-actions v-if="updatedAt" :scope="scope" :dates="selectedDates" :permissions="$store.getters.permissions || []" :can-fault="canFault" :pending="loading ? 0 : Number(faultSummary.active) || 0" />
    <div class="dashboard-analytics">
      <section class="overview-panel analytics-trend"><div class="panel-heading"><h2>{{ trendView==='energy'?'充电量趋势':'订单与净收入趋势' }}</h2><el-radio-group v-model="trendView" size="mini" aria-label="趋势指标"><el-radio-button label="business">订单与收入</el-radio-button><el-radio-button label="energy">充电量</el-radio-button></el-radio-group></div><div class="analytics-chart"><overview-chart :data="trend" :orders="trendView==='business'" :energy="trendView==='energy'" /></div></section>
      <section class="overview-panel dashboard-status"><div class="panel-heading"><h2>设备运行状态</h2><span class="panel-hint">当前快照</span></div><div class="analytics-chart"><overview-chart kind="status" :summary="summary" /></div><div class="device-counts"><span>在线 <b>{{ metric(summary.onLine) }}</b></span><span>离线 <b>{{ metric(summary.offLine) }}</b></span><span>未确认 <b>{{ metric(summary.unknownState) }}</b></span></div></section>
      <dashboard-insights :hourly="hourly" :quality="orderQuality" />
      <section v-if="!selectedStation" class="overview-panel dashboard-business">
        <div class="panel-heading">
          <div v-if="showOperatorTab" class="business-tabs" role="group" aria-label="经营表格"><button :class="{active:businessView==='operators'}" type="button" @click="businessView='operators'">运营商经营</button><button :class="{active:businessView==='stations'}" type="button" @click="businessView='stations'">站点排行</button></div><h2 v-else>站点经营</h2>
          <span class="panel-hint">{{ businessSortLabel }} · 日期跟随顶部</span>
        </div>
        <div class="business-filters" role="group" aria-label="排行筛选">
          <el-input v-model="businessKeyword" :placeholder="operatorTable?'搜索运营商名称':'搜索站点名称'" :aria-label="operatorTable?'搜索运营商名称':'搜索站点名称'" prefix-icon="el-icon-search" clearable size="small" />
          <el-button type="text" size="small" @click="resetBusinessFilters">重置排行</el-button>
          <span class="business-result-count" aria-live="polite">共 {{ businessRows.length }} {{ operatorTable?'家运营商':'个站点' }}</span>
        </div>
        <el-table :key="String(operatorTable)" ref="businessTable" :data="visibleBusinessRows" :default-sort="{prop:'revenue',order:'descending'}" :empty-text="businessKeyword.trim() ? '没有符合筛选条件的数据' : '当前范围暂无数据'" stripe @sort-change="sortBusiness">
          <el-table-column type="index" label="排名" width="52" :index="index => (tablePage-1)*5+index+1" />
          <el-table-column prop="name" :label="operatorTable?'运营商':'站点名称'" min-width="155" show-overflow-tooltip />
          <el-table-column v-if="operatorTable" prop="stationCount" label="站点数" width="90" align="right" sortable="custom" :sort-orders="['ascending','descending']" />
          <el-table-column v-if="operatorTable" prop="deviceCount" label="设备数" width="90" align="right" sortable="custom" :sort-orders="['ascending','descending']" />
          <el-table-column prop="count" label="订单数" min-width="100" align="right" sortable="custom" :sort-orders="['ascending','descending']"><template slot-scope="item">{{ metric(item.row.count) }}</template></el-table-column>
          <el-table-column prop="revenue" label="净收入 / 元" min-width="135" align="right" sortable="custom" :sort-orders="['ascending','descending']"><template slot-scope="item">{{ metric(item.row.revenue,2) }}</template></el-table-column>
          <el-table-column prop="revenuePerDevice" label="单桩收入 / 元" min-width="145" align="right" sortable="custom" :sort-orders="['ascending','descending']"><template slot-scope="item">{{ metric(item.row.revenuePerDevice,2) }}</template></el-table-column>
          <el-table-column prop="activeDeviceRate" label="有单设备占比" min-width="145" align="right" sortable="custom" :sort-orders="['ascending','descending']"><template slot-scope="item">{{ item.row.activeDeviceRate==null?'—':metric(item.row.activeDeviceRate,1)+'%' }}</template></el-table-column>
          <el-table-column label="操作" width="86" align="right"><template slot-scope="item"><el-button type="text" @click="openBusiness(item.row)">查看详情</el-button></template></el-table-column>
        </el-table>
        <p class="business-definition">单桩收入＝所选日期净收入÷当前设备数；有单设备占比＝所选日期有订单的当前设备数÷当前设备数，非时长利用率。</p>
        <div v-if="businessRows.length>5" class="table-pagination"><span>每页 5 条</span><el-pagination small layout="prev, pager, next" :page-size="5" :pager-count="5" :total="businessRows.length" :current-page.sync="tablePage" /></div>
      </section>
      <section class="overview-panel dashboard-pending"><div class="panel-heading"><h2>待处理事项</h2><span class="panel-hint">当前状态</span></div><button class="pending-row" type="button" :disabled="!canFault || loading" @click="openFaults"><span class="pending-description"><span><i class="el-icon-warning-outline" /> 未关闭故障工单</span><small v-if="canFault">待分配 {{ metric(faultSummary.pending) }} · 待确认 {{ metric(faultSummary.resolved) }}</small></span><span><strong>{{ canFault ? metric(faultSummary.active) : '无查看权限' }}</strong><i v-if="canFault" class="el-icon-arrow-right" /></span></button><button class="pending-row" type="button" :disabled="!canPile || loading" @click="openOffline"><span class="pending-description"><span><i class="el-icon-connection" /> 离线设备</span><small v-if="canPile">超24小时 {{ metric(actionSummary.offline24Count) }} · 时间缺失 {{ metric(actionSummary.offlineUnknownCount) }}</small></span><span><strong>{{ metric(summary.offLine) }}</strong><i v-if="canPile" class="el-icon-arrow-right" /></span></button><p class="pending-tip">点击查看明细，优先处理持续时间较长的记录。</p></section>
    </div>
    <p class="dashboard-footnote"><span v-if="containsDemoData" class="demo-note">当前范围含演示样本，仅供功能展示，不代表真实经营。 </span>经营数据按订单创建日期汇总，净收入为订单金额扣除退款；站点、设备与待办为当前状态。</p>
    <el-dialog :title="pendingKind==='faults'?'未关闭故障工单':'离线设备'" :visible.sync="pendingVisible" width="min(1000px,94vw)" class="pending-dialog"><p class="pending-scope">{{ scopeLabel }} · 当前状态，按时间由早到晚，最多展示前20条</p><el-table :data="pendingKind==='faults'?pendingFaults:offlineDevices" max-height="420" empty-text="当前范围暂无待处理数据"><el-table-column prop="pileId" label="设备编号" min-width="140" show-overflow-tooltip /><el-table-column prop="stationName" label="所属站点" min-width="140" show-overflow-tooltip /><el-table-column v-if="pendingKind==='faults'" prop="description" label="故障描述" min-width="170" show-overflow-tooltip /><el-table-column v-else prop="name" label="设备名称" min-width="140" show-overflow-tooltip /><el-table-column v-if="pendingKind==='faults'" label="状态" width="90"><template slot-scope="item">{{ ticketStatus(item.row.status) }}</template></el-table-column><el-table-column :label="pendingKind==='faults'?'创建时间':'离线时间'" min-width="160"><template slot-scope="item">{{ item.row[pendingKind==='faults'?'createdAt':'offlineTime'] || '时间未记录' }}</template></el-table-column><el-table-column :label="pendingKind==='faults'?'未关闭时长':'离线时长'" min-width="130"><template slot-scope="item"><span :class="{'duration-warning':Number(item.row[pendingKind==='faults'?'ageMinutes':'offlineMinutes'])>=1440}">{{ durationText(item.row[pendingKind==='faults'?'ageMinutes':'offlineMinutes']) }}</span></template></el-table-column><el-table-column label="操作" width="100"><template slot-scope="item"><el-button type="text" @click="openPendingRow(item.row)">{{ pendingKind==='faults'?'处理工单':'查看设备' }}</el-button></template></el-table-column></el-table></el-dialog>
    <el-dialog title="站点详情" :visible.sync="stationDetailVisible" width="min(540px,94vw)">
      <el-descriptions v-if="selectedStation" :column="1" border><el-descriptions-item label="站点名称">{{ selectedStation.stationName }}</el-descriptions-item><el-descriptions-item label="站点编号">{{ selectedStation.stationId }}</el-descriptions-item><el-descriptions-item label="地址">{{ selectedStation.address || '地址待录入' }}</el-descriptions-item><el-descriptions-item label="所属运营商">{{ scopeLabel.split(' / ')[0] }}</el-descriptions-item></el-descriptions>
      <template v-if="selectedStation" #footer>
        <el-button type="primary" @click="openStationDevices">查看设备</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script>
import overview from './data'
import ScopeSelector from './ScopeSelector'
import OverviewChart from './OverviewChart'
import QuickActions from './QuickActions'
import DashboardInsights from './DashboardInsights'
import { businessMetrics, periodComparison, durationText, ticketStatus } from './insights'
import { businessToday, presetPeriod, validatePeriod } from './period'

const presets = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' }
]
export default {
  name: 'Index',
  components: { ScopeSelector, OverviewChart, QuickActions, DashboardInsights },
  mixins: [overview],
  data() { return { presets, calendarDay: businessToday(), retainOverviewOnFailure: true, stationDetailVisible: false, pendingVisible: false, pendingKind: 'faults', customMode: false, businessView: 'operators', tablePage: 1, businessKeyword: '', businessSort: { prop: 'revenue', order: 'descending' }, trendView: 'business' } },
  computed: {
    activePreset() {
      const { periodPreset, startDate, endDate } = this.$route.query
      if (presets.some(item => item.value === periodPreset)) return periodPreset
      if (!startDate && !endDate) return '7'
      return 'custom'
    },
    selectedDates() {
      const { startDate, endDate } = this.$route.query
      return this.activePreset === 'custom' ? [startDate, endDate] : presetPeriod(this.activePreset, this.calendarDay)
    },
    periodPreset() { return this.customMode ? 'custom' : this.activePreset },
    showOperatorTab() { return this.scope.root && !this.scope.tenantId && !this.scope.stationId },
    operatorTable() { return this.showOperatorTab && this.businessView === 'operators' },
    businessRows() {
      const keyword = this.businessKeyword.trim().toLocaleLowerCase('zh-CN')
      const rows = (this.operatorTable ? this.operatorStats : this.stationStats).filter(row => !keyword || String(row.name || '').toLocaleLowerCase('zh-CN').includes(keyword)).map(businessMetrics)
      const { prop, order } = this.businessSort
      return rows.sort((a, b) => {
        if (a[prop] == null || b[prop] == null) return a[prop] == null ? b[prop] == null ? 0 : 1 : -1
        const difference = (Number(a[prop]) || 0) - (Number(b[prop]) || 0)
        return difference ? difference * (order === 'ascending' ? 1 : -1) : String(a.tenantId || '').localeCompare(String(b.tenantId || '')) || String(a.stationId || '').localeCompare(String(b.stationId || ''))
      })
    },
    businessSortLabel() { return '按' + ({ revenue: '净收入', count: '订单数', stationCount: '站点数', deviceCount: '设备数', revenuePerDevice: '单桩收入', activeDeviceRate: '有单设备占比' }[this.businessSort.prop]) + (this.businessSort.order === 'ascending' ? '升序' : '降序') },
    comparisonPeriod() { const p = this.comparison.period; return p ? '对比时段：' + p.startDate + ' 至 ' + p.endDate : '暂无可比时段' },
    comparisonLabel() { const p = this.comparison.period; const days = p && (Date.parse(p.endDate) - Date.parse(p.startDate)) / 86400000 + 1; return Number.isInteger(days) && days > 0 ? '较前' + days + '天' : '较前一等长时段' },
    visibleBusinessRows() { return this.businessRows.slice((this.tablePage - 1) * 5, this.tablePage * 5) },
    containsDemoData() { return this.stations.some(station => String(station.stationName).startsWith('【演示】')) },
    canPile() { const p = this.$store.getters.permissions || []; return p.includes('*:*:*') || p.includes('operator:pile:list') },
    cards() {
      return [
        { label: '净收入', key: 'realSales', value: this.summary.realSales, digits: 2, unit: '元', icon: 'el-icon-wallet', note: '已扣除退款' },
        { label: '订单数', key: 'chargeTimes', value: this.summary.chargeTimes, unit: '笔', icon: 'el-icon-document' },
        { label: '充电量', key: 'consumePower', value: this.summary.consumePower, digits: 2, unit: 'kWh', icon: 'el-icon-lightning' },
        { label: '站点数', value: this.stationTotal, unit: '个', icon: 'el-icon-location-outline' }
      ]
    }
  },
  watch: {
    '$route.query'(query, previous) { this.customMode = false; this.pendingVisible = false; this.stationDetailVisible = false; this.tablePage = 1; if (query.tenantId !== previous.tenantId || query.stationId !== previous.stationId) this.resetBusinessFilters() },
    businessView() { this.resetBusinessFilters() },
    businessKeyword() { this.tablePage = 1 }
  },
  created() { this.refreshOverview() },
  methods: {
    openStationDevices() {
      const { stationId, tenantId } = this.selectedStation
      this.$router.push({ path: '/operate/station', query: { stationId: String(stationId), tenantId: String(tenantId) } })
    },
    durationText, ticketStatus,
    comparisonFor(card) { return periodComparison(card.value, this.comparison.available && this.comparison.summary ? this.comparison.summary[card.key] : null, this.comparisonLabel) },
    sortBusiness({ prop, order }) { this.businessSort = prop && order ? { prop, order } : { prop: 'revenue', order: 'descending' }; this.tablePage = 1 },
    resetBusinessFilters() {
      this.businessKeyword = ''; this.businessSort = { prop: 'revenue', order: 'descending' }; this.tablePage = 1
      this.$nextTick(() => { if (this.$refs.businessTable) this.$refs.businessTable.sort('revenue', 'descending') })
    },
    overviewParams() {
      this.calendarDay = businessToday()
      const [startDate, endDate] = validatePeriod(...this.selectedDates)
      return { tenantId: this.$route.query.tenantId, stationId: this.$route.query.stationId, startDate, endDate }
    },
    choosePeriod(value) {
      if (value === 'custom') return this.openCustomDates()
      this.customMode = false
      return this.applyDates(presetPeriod(value), value)
    },
    openCustomDates() { this.customMode = true; this.$nextTick(() => this.$refs.periodPicker.focus()) },
    async applyDates(value, preset) {
      try {
        const [startDate, endDate] = validatePeriod(...(value || []))
        const query = { ...this.$route.query, startDate, endDate }
        if (preset) query.periodPreset = preset
        else delete query.periodPreset
        await this.$router.push({ query }).catch(() => {})
      } catch (e) {
        this.$message.warning(e.message)
      }
    },
    openBusiness(row) { return this.changeScope(this.operatorTable ? { tenantId: row.tenantId } : { tenantId: row.tenantId, stationId: row.stationId }) },
    openFaults() { this.pendingKind = 'faults'; this.pendingVisible = true },
    openOffline() { this.pendingKind = 'offline'; this.pendingVisible = true },
    openPendingRow(row) { this.pendingVisible = false; this.$router.push(this.pendingKind === 'faults' ? { path: '/operate/fault', query: { ticketId: String(row.id) }} : { path: '/operate/pile', query: { pileId: String(row.pileId) }}) }
  }
}
</script>
<style scoped>
.page-heading h1,.heading-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.period-presets{display:flex;flex-wrap:wrap;row-gap:6px}
.operations-dashboard{padding:22px 24px;background:#f4f7fc;min-height:calc(100vh - 84px);color:#23334e}.page-heading,.heading-actions,.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.page-heading{margin-bottom:16px}h1{margin:0;font-size:20px;font-weight:600}h2{margin:0;font-size:15px;font-weight:600}.update-time,.panel-hint{color:#8b98ac;font-size:12px}.heading-actions{justify-content:flex-end}.dashboard-period{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-left:auto}.dashboard-period .el-date-editor{width:264px}.operations-dashboard ::v-deep .scope-selector{gap:12px;padding:14px 16px;margin-bottom:18px}.operations-dashboard ::v-deep .scope-selector .el-select{width:180px}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.metric-card,.overview-panel{background:#fff;border:1px solid #e1e8f3;border-radius:8px;min-width:0}.metric-card{padding:18px 20px}.metric-label{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:#63758f}.metric-label i{font-size:20px;color:#3477ed}.metric-value{display:flex;align-items:baseline;gap:8px;margin:16px 0 10px}.metric-value strong{font-size:27px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.metric-value span,.metric-card small{font-size:12px;color:#8b98ac}.dashboard-analytics{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:18px;align-items:start}.overview-panel{padding:16px}.panel-heading{min-height:27px;margin-bottom:10px;flex-wrap:wrap}.analytics-trend,.dashboard-status{height:320px;display:flex;flex-direction:column}.analytics-chart{flex:1;min-height:0}.device-counts{display:flex;justify-content:center;gap:16px;margin-top:6px;color:#8b98ac;font-size:12px}.device-counts b{color:#4f6482;font-weight:500}.business-tabs{display:flex;gap:20px}.business-tabs button{padding:0 0 7px;border:0;border-bottom:2px solid transparent;background:transparent;color:#8390a5;font-size:15px;font-weight:600;cursor:pointer}.business-tabs button.active{border-color:#2563eb;color:#2563eb}.business-tabs button:focus-visible,.pending-row:focus-visible{outline:2px solid #2563eb;outline-offset:3px}.dashboard-business ::v-deep .el-table th{background:#f0f5ff;color:#637b9d}.dashboard-business ::v-deep .el-table td{font-size:12px;padding:8px 0}.dashboard-business ::v-deep .el-table .el-button{padding:7px 0;font-size:12px}.table-pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;font-size:12px;color:#8b98ac}.pending-row{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;border-bottom:1px solid #edf1f7;background:#fff;padding:22px 0;text-align:left;cursor:pointer;color:#64758e;font-size:13px;gap:10px}.pending-row>span{display:flex;align-items:center;gap:8px}.pending-row strong{font-size:19px;font-weight:600;color:#2563eb;font-variant-numeric:tabular-nums}.pending-row .el-icon-arrow-right{font-size:12px;color:#8b98ac}.pending-row:hover:not(:disabled){color:#2563eb;background:#f8faff}.pending-row:disabled{cursor:default}.pending-row:disabled strong{font-size:13px;color:#8b98ac}.demo-note{color:#ad7c25}.dashboard-footnote{margin:16px 0 0;color:#8b98ac;font-size:12px;line-height:1.8}.data-warning{margin-bottom:12px}.station-detail{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.station-detail>div{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.station-detail span{color:#8b98ac;font-size:12px}.station-detail>.el-button{flex-shrink:0}
.business-filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0 14px}.business-filters .el-input{width:200px;max-width:100%}.business-filters .el-checkbox{margin:0;color:#64758e}.business-result-count{margin-left:auto;color:#8b98ac;font-size:12px}.business-filters .el-button{margin:0}.dashboard-business ::v-deep .el-table__body-wrapper{overflow-x:auto}
@media(max-width:520px){.business-filters{gap:10px 12px}.business-filters .el-input{width:100%}.business-result-count{margin-left:0}}
@media(max-width:1250px){.dashboard-period{width:100%;margin-left:0}.dashboard-analytics{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}}
@media(max-width:950px){.operations-dashboard{padding:16px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-analytics{grid-template-columns:1fr}.analytics-trend,.dashboard-status{height:300px}.dashboard-business{overflow:hidden}.dashboard-pending{grid-column:1}.update-time{display:none}.station-detail{align-items:flex-start}.station-detail>div{gap:6px 12px}}
@media(max-width:520px){.operations-dashboard{padding:12px}.operations-dashboard ::v-deep .scope-selector>label{width:100%;justify-content:space-between}.operations-dashboard ::v-deep .scope-selector .el-select{width:calc(100% - 48px)}.dashboard-period{gap:12px}.dashboard-period .el-date-editor{width:100%;max-width:100%;min-width:0}.dashboard-period ::v-deep .el-range-input{min-width:0}.metric-grid{gap:10px}.metric-card{padding:14px}.metric-value{gap:5px;flex-wrap:wrap}.metric-value strong{font-size:23px}.overview-panel{padding:12px}.panel-hint{font-size:11px}.business-tabs{gap:14px}.business-tabs button{font-size:14px}.table-pagination{flex-wrap:wrap}.station-detail{flex-wrap:wrap}.device-counts{gap:12px}}
</style>

<style scoped>
.metric-definition{margin-left:8px;font-size:11px!important}.metric-comparison{margin-top:9px;font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums}.metric-comparison.up{color:#148b75}.metric-comparison.down{color:#c26552}.metric-comparison.neutral{color:#8b98ac}.pending-row>.pending-description{display:flex;flex-direction:column;align-items:flex-start;gap:10px}.pending-description small,.pending-tip,.business-definition{font-size:11px;color:#8b98ac;line-height:1.7}.pending-tip{margin:14px 0 0}.business-definition{margin:10px 0 0}.duration-warning{color:#b86d22}.analytics-trend .panel-heading{gap:8px}.analytics-trend .panel-heading h2{font-size:14px}
.dashboard-business{grid-column:1/-1;order:2}.dashboard-pending{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;order:1}.dashboard-pending .panel-heading,.pending-tip{grid-column:1/-1}.dashboard-pending .pending-row{padding:16px 0}.dashboard-pending .pending-tip{margin-top:10px}@media(max-width:700px){.dashboard-pending{grid-template-columns:1fr}}
</style>
<style>
@media(max-width:680px){.dashboard-date-picker.el-date-range-picker{width:calc(100vw - 24px);max-height:70vh;overflow-y:auto}.dashboard-date-picker .el-picker-panel__body{min-width:0}.dashboard-date-picker .el-date-range-picker__content{width:100%;float:none;padding:12px}.dashboard-date-picker .el-date-range-picker__content.is-left{border-right:0;border-bottom:1px solid #e4e7ed}}
</style>
