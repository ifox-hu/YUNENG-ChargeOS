<template><div ref="chart" class="operation-chart" /></template>
<script>
import * as echarts from 'echarts'
export default {
  name: 'OperationChart',
  props: { option: { type: Object, required: true }},
  watch: { option: { deep: true, handler() { this.render() } }},
  mounted() {
    this.chart = echarts.init(this.$refs.chart)
    this.resize = () => this.chart && this.chart.resize()
    window.addEventListener('resize', this.resize)
    if (window.ResizeObserver) { this.observer = new ResizeObserver(this.resize); this.observer.observe(this.$el) }
    this.render()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    if (this.observer) this.observer.disconnect()
    if (this.chart) this.chart.dispose()
    this.chart = null
  },
  methods: { render() { if (this.chart) this.chart.setOption(this.option, true) } }
}
</script>
<style scoped>.operation-chart { height: 310px; width: 100%; }</style>
