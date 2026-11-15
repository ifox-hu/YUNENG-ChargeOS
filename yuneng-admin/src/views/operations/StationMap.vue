<template>
  <div class="station-map-wrap">
    <div v-if="mapError" class="map-error">地图加载失败 <el-button type="text" @click="initialize">重新加载</el-button></div>
    <div ref="canvas" data-testid="station-map" class="station-map" />
    <span class="map-credit">行政区划：DataV · 颜色表示站点数量</span>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { stationPosition } from './data'
let geometryPromise
function loadGeometry() {
  if (!geometryPromise) {
    geometryPromise = fetch(process.env.BASE_URL + 'maps/china.json').then(response => {
      if (!response.ok) throw new Error('Map unavailable')
      return response.json()
    }).catch(error => { geometryPromise = null; throw error })
  }
  return geometryPromise
}
export default {
  name: 'StationMap',
  props: { stations: { type: Array, default: () => [] }, dark: Boolean },
  data() { return { mapError: false } },
  watch: { stations() { this.draw() }, dark() { this.draw() } },
  mounted() { this.initialize(); window.addEventListener('resize', this.resize) },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    if (this.observer) this.observer.disconnect()
    if (this.chart) this.chart.dispose()
  },
  methods: {
    async initialize() {
      this.mapError = false
      try {
        this.geometry = await loadGeometry()
        if (this._isDestroyed || this._isBeingDestroyed) return
        echarts.registerMap('yuneng-china', this.geometry)
        if (!this.chart) {
          this.chart = echarts.init(this.$refs.canvas)
          this.chart.on('click', event => {
            if (event.seriesType === 'scatter') this.$emit('select', event.data.station)
            else if (event.name) {
              const feature = this.geometry.features.find(item => item.properties.name === event.name)
              if (feature) this.$emit('region', { name: event.name, prefix: String(feature.properties.adcode).slice(0, 2) })
            }
          })
          if (window.ResizeObserver) {
            this.observer = new ResizeObserver(this.resize)
            this.observer.observe(this.$refs.canvas)
          }
        }
        this.draw()
      } catch (error) { if (!this._isDestroyed) this.mapError = true }
    },
    resize() { if (this.chart && !this.chart.isDisposed()) this.chart.resize() },
    draw() {
      if (!this.chart || !this.geometry) return
      const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
      const data = this.geometry.features.map(feature => {
        const code = String(feature.properties.adcode).slice(0, 2)
        return { name: feature.properties.name, value: this.stations.filter(station => String(station.regionCode || '').slice(0, 2) === code || station.province === feature.properties.name).length }
      })
      const points = this.stations.filter(station => stationPosition(station)).map(station => ({ name: station.stationName, value: stationPosition(station), station }))
      this.chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: item => item.seriesType === 'scatter' ? escape(item.name) + '<br/>' + escape(item.data.station.address) + (item.data.station.coordinateSource === 'DEMO' ? '<br/>演示示意位置，非真实设备定位' : '') : escape(item.name) + '：' + (item.value || 0) + ' 个站点' },
        visualMap: { min: 0, max: Math.max(1, ...data.map(item => item.value)), left: 12, bottom: 22, text: ['多', '少'], calculable: false, seriesIndex: 0, inRange: { color: this.dark ? ['#102840', '#12678e', '#00c8ed'] : ['#e8f0fa', '#91b8f8', '#2864ee'] }, textStyle: { color: this.dark ? '#a2cde3' : '#60708a' }, itemHeight: 95 },
        geo: { map: 'yuneng-china', roam: true, zoom: 1.12, itemStyle: { areaColor: this.dark ? '#102840' : '#eef3fa', borderColor: this.dark ? '#467e9a' : '#a7bed8' }, emphasis: { label: { show: true, color: this.dark ? '#fff' : '#173971' }, itemStyle: { areaColor: this.dark ? '#087eaf' : '#c1d9ff' }}},
        series: [
          { type: 'map', geoIndex: 0, data },
          { type: 'scatter', coordinateSystem: 'geo', data: points, symbol: 'pin', symbolSize: 27, itemStyle: { color: this.dark ? '#ffd56d' : '#ff9a2c', borderColor: '#fff', borderWidth: 1 }, z: 3 }
        ]
      }, true)
    }
  }
}
</script>

<style scoped>
.station-map-wrap { position: relative; height: 100%; min-height: 330px; }
.station-map { width: 100%; height: 100%; min-height: 330px; }
.map-error { position: absolute; top: 15px; left: 45%; z-index: 2; color: #df7933; }
.map-credit { position: absolute; bottom: 7px; right: 12px; color: #8294a9; font-size: 11px; pointer-events: none; }
</style>
