<template><div ref="chart" class="insight-chart" role="img" :aria-label="kind==='hourly'?'按下单小时分布':'订单状态分布'" /></template>
<script>
import * as echarts from 'echarts'
export default {
  name: 'InsightChart',
  props: { kind: { type: String, default: 'hourly' }, data: { type: Array, default: () => [] }, metricKey: { type: String, default: 'count' }},
  watch: { data() { this.draw() }, metricKey() { this.draw() } },
  mounted() { this.chart = echarts.init(this.$refs.chart); this.draw(); this.observer = new ResizeObserver(() => this.chart && this.chart.resize()); this.observer.observe(this.$el) },
  beforeDestroy() { if (this.observer) this.observer.disconnect(); if (this.chart) this.chart.dispose() },
  methods: {
    draw() {
      if (!this.chart) return
      const ink = '#8390a5'; const energy = this.metricKey === 'power'
      const base = { animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, textStyle: { fontFamily: 'Microsoft YaHei', color: ink }, tooltip: { confine: true, backgroundColor: '#fff', borderColor: '#e1e8f3', textStyle: { color: '#23334e' }}}
      if (this.kind === 'hourly') {
        this.chart.setOption({ ...base, tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }}, grid: { top: 30, left: 55, right: 15, bottom: 28 }, xAxis: { type: 'category', data: this.data.map(row => String(row.hour).padStart(2, '0') + ':00'), axisLabel: { interval: 3, fontSize: 10 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e3eaf4' }}}, yAxis: { type: 'value', name: energy ? 'kWh' : '笔', minInterval: energy ? 0 : 1, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: '#eff3f8', type: 'dashed' }}}, series: [{ type: 'bar', name: energy ? '充电量 / kWh' : '订单 / 笔', barMaxWidth: 18, itemStyle: { color: energy ? '#13b39a' : '#3477ed', borderRadius: [3, 3, 0, 0] }, data: this.data.map(row => Number(Number(row[this.metricKey] || 0).toFixed(2))) }] }, true)
      } else {
        const total = this.data.reduce((sum, row) => sum + Number(row.count || 0), 0)
        this.chart.setOption({ ...base, tooltip: { ...base.tooltip, trigger: 'item' }, color: ['#8b9db9', '#e8a438', '#3477ed', '#e57979', '#16b49e', '#62b5dd', '#7b85c2', '#c3cbd8'], title: { text: total ? total.toLocaleString('zh-CN') : '暂无订单', subtext: total ? '订单总数 / 笔' : '', left: 'center', top: '27%', textStyle: { fontSize: total ? 25 : 15, color: '#23334e' }, subtextStyle: { fontSize: 11, color: ink }}, legend: { type: 'scroll', bottom: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: ink, fontSize: 11 }}, series: [{ type: 'pie', radius: ['46%', '65%'], center: ['50%', '41%'], label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 3 }, data: this.data.map((row, index) => ({ name: row.name, value: Number(row.count), itemStyle: { color: ['#8b9db9', '#e8a438', '#3477ed', '#e57979', '#16b49e', '#62b5dd', '#7b85c2', '#c3cbd8'][index] }})).filter(row => row.value > 0) }] }, true)
      }
    }
  }
}
</script>
<style scoped>.insight-chart{height:100%;min-height:180px;width:100%}</style>
