<template><div ref="chart" class="overview-chart" :aria-label="kind === 'trend' ? energy ? '充电量趋势' : orders ? '订单与净收入趋势' : '净收入趋势' : '设备在线状态'" /></template>
<script>
import * as echarts from 'echarts'
export default {
  name: 'OverviewChart',
  props: { kind: { type: String, default: 'trend' }, data: { type: Array, default: () => [] }, summary: { type: Object, default: () => ({}) }, dark: Boolean, orders: Boolean, energy: Boolean, motion: { type: Boolean, default: true }},
  watch: { data() { this.draw() }, summary() { this.draw() }, motion() { this.draw() }, orders() { this.draw() }, energy() { this.draw() } },
  mounted() { this.chart = echarts.init(this.$refs.chart); this.draw(); this.observer = new ResizeObserver(() => this.chart && this.chart.resize()); this.observer.observe(this.$el) },
  beforeDestroy() { if (this.observer) this.observer.disconnect(); if (this.chart) this.chart.dispose() },
  methods: {
    draw() {
      if (!this.chart) return
      const ink = this.dark ? '#81a6c2' : '#8390a5'
      const accent = this.dark ? '#30e4f3' : '#2563eb'
      const animation = this.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches
      const base = { animation, backgroundColor: 'transparent', textStyle: { fontFamily: 'Microsoft YaHei', color: ink }, tooltip: { trigger: this.kind === 'trend' ? 'axis' : 'item', confine: true, backgroundColor: this.dark ? '#081d30' : '#fff', borderColor: this.dark ? '#1c6885' : '#e1e8f3', textStyle: { color: this.dark ? '#d1f7ff' : '#23334e' }}}
      if (this.kind === 'trend') {
        const option = { ...base, grid: { top: 24, right: 15, bottom: 25, left: 58 }, xAxis: { type: 'category', boundaryGap: false, data: this.data.map(d => d.day.slice(5)), axisLine: { lineStyle: { color: this.dark ? '#1b3b57' : '#e3eaf4' }}, axisTick: { show: false }, axisLabel: { color: ink, fontSize: 10 }}, yAxis: { type: 'value', name: '元', nameTextStyle: { color: ink, fontSize: 10 }, splitLine: { lineStyle: { color: this.dark ? '#12304a' : '#eff3f8', type: 'dashed' }}, axisLabel: { color: ink, fontSize: 10 }}, series: [{ name: '净收入 / 元', type: 'line', smooth: 0.25, showSymbol: false, lineStyle: { color: accent, width: 2 }, itemStyle: { color: accent }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: this.dark ? '#11bfee55' : '#2563eb30' }, { offset: 1, color: this.dark ? '#11bfee00' : '#2563eb00' }]) }, data: this.data.map(d => Number(d.revenue)) }] }
        if (this.energy) {
          option.yAxis.name = 'kWh'; option.series[0].name = '充电量 / kWh'; option.series[0].data = this.data.map(d => Number(d.power)); option.series[0].showSymbol = this.data.length <= 7
        } else if (this.orders) {
          option.grid.top = 58; option.grid.right = 58; option.grid.bottom = 32
          option.legend = { top: 8, itemWidth: 18, itemHeight: 9, textStyle: { color: ink, fontSize: 11 }}
          option.yAxis = [option.yAxis, { type: 'value', name: '笔', minInterval: 1, position: 'right', nameTextStyle: { color: ink, fontSize: 10 }, splitLine: { show: false }, axisLabel: { color: ink, fontSize: 10 }}]
          option.series.push({ name: '订单 / 笔', type: 'line', yAxisIndex: 1, smooth: 0.25, showSymbol: this.data.length <= 7, symbolSize: 5, lineStyle: { color: '#13b39a', width: 2 }, itemStyle: { color: '#13b39a' }, data: this.data.map(d => Number(d.count)) })
          option.series[0].showSymbol = this.data.length <= 7
        }
        this.chart.setOption(option, true)
      } else {
        const available = this.summary.totalNumbers != null
        this.chart.setOption({ ...base, color: this.dark ? [accent, '#2453a0', '#dcb66b'] : ['#16b49e', '#aab6cb', '#e8a438'], title: { text: available ? String(this.summary.totalNumbers) : '—', subtext: '设备总数 / 台', left: 'center', top: '32%', textStyle: { color: this.dark ? '#e7fcff' : '#23334e', fontSize: 34 }, subtextStyle: { color: ink, fontSize: 11 }}, legend: { bottom: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: ink, fontSize: 11 }}, series: [{ type: 'pie', radius: ['64%', '80%'], center: ['50%', '44%'], label: { show: false }, itemStyle: { borderColor: this.dark ? '#07182b' : '#fff', borderWidth: 4 }, data: available ? [{ name: '在线', value: Number(this.summary.onLine || 0) }, { name: '离线', value: Number(this.summary.offLine || 0) }, { name: '状态未确认', value: Number(this.summary.unknownState || 0) }].filter(d => d.value) : [] }] }, true)
      }
    }
  }
}
</script>
<style scoped>.overview-chart{height:100%;min-height:180px;width:100%;}</style>
