<template>
  <div class="dashboard-insights">
    <section class="insights-panel hourly-panel">
      <div class="insights-heading"><h2>充电时段分布</h2><el-radio-group v-model="hourMetric" size="mini" aria-label="时段统计指标"><el-radio-button label="count">订单数</el-radio-button><el-radio-button label="power">充电量</el-radio-button></el-radio-group></div>
      <p>按所选日期内的下单时间汇总 · 北京时间</p>
      <div class="insights-chart"><insight-chart kind="hourly" :data="hourly" :metric-key="hourMetric" /></div>
      <div class="insights-footer">{{ peakText }}</div>
    </section>
    <section class="insights-panel quality-panel">
      <div class="insights-heading"><h2>订单质量分析</h2><span>所选日期 · 当前订单状态</span></div>
      <div class="insights-chart"><insight-chart kind="quality" :data="quality.states || []" /></div>
      <div class="quality-metrics"><div><span>退款笔数</span><b>{{ metric(quality.refundCount) }}<small> 笔</small></b></div><div><span>退款金额</span><b>{{ metric(quality.refundAmount,2) }}<small> 元</small></b></div><div><span>取消占比</span><b>{{ cancelledRate }}</b></div></div>
    </section>
  </div>
</template>
<script>
import InsightChart from './InsightChart'
import { metric } from './data'
export default {
  name: 'DashboardInsights',
  components: { InsightChart },
  props: { hourly: { type: Array, default: () => [] }, quality: { type: Object, default: () => ({}) }},
  data() { return { hourMetric: 'count' } },
  computed: {
    cancelledRate() { const total = (this.quality.states || []).reduce((sum, row) => sum + Number(row.count || 0), 0); return total ? metric(Number(this.quality.cancelledCount || 0) / total * 100, 1) + '%' : '—' },
    peakText() {
      const peak = this.hourly.reduce((best, row) => Number(row[this.hourMetric]) > Number(best[this.hourMetric] || 0) ? row : best, {})
      if (!Number(peak[this.hourMetric])) return '所选日期暂无' + (this.hourMetric === 'count' ? '订单' : '充电量') + '数据'
      return '最高时段 ' + String(peak.hour).padStart(2, '0') + ':00–' + String(Number(peak.hour) + 1).padStart(2, '0') + ':00 · ' + metric(peak[this.hourMetric], this.hourMetric === 'count' ? 0 : 2) + (this.hourMetric === 'count' ? ' 笔' : ' kWh') + '（并列取最早）'
    }
  },
  methods: { metric }
}
</script>
<style scoped>
.dashboard-insights{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:18px}.insights-panel{background:#fff;border:1px solid #e1e8f3;border-radius:8px;padding:16px;min-width:0;height:340px;display:flex;flex-direction:column}.insights-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-height:28px}.insights-heading h2{margin:0;font-size:15px;font-weight:600}.insights-heading>span,.insights-panel p,.insights-footer{font-size:12px;color:#8b98ac}.insights-panel p{margin:7px 0 0}.insights-chart{flex:1;min-height:0}.insights-footer{padding-top:7px;border-top:1px solid #edf1f7;line-height:1.5}.quality-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid #edf1f7;padding-top:12px}.quality-metrics>div{display:flex;flex-direction:column;gap:8px;min-width:0}.quality-metrics span{color:#8b98ac;font-size:12px}.quality-metrics b{font-size:16px;color:#23334e;font-weight:600;overflow-wrap:anywhere}.quality-metrics small{font-size:11px;font-weight:400;color:#8b98ac}@media(max-width:1250px){.dashboard-insights{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}}@media(max-width:950px){.dashboard-insights{grid-template-columns:1fr}.insights-panel{height:330px}}@media(max-width:520px){.insights-panel{padding:12px}.insights-heading>span{font-size:11px}.insights-footer{font-size:11px}}
</style>
