<template>
  <div class="atlas-scene" :class="{ 'atlas-ready': ready }" data-testid="atlas-scene">
    <station-map v-if="!ready" :stations="stations" dark class="atlas-fallback" />
    <div ref="stage" class="atlas-stage" role="img" aria-label="中国省级站点分布三维地图，光柱表示省级站点数量，金色圆点为有有效坐标的站点" />
    <div class="atlas-label"><span class="atlas-cross">+</span><span>{{ ready ? '3D GEO ATLAS' : 'GEO ATLAS' }}<b>全国充电网络</b></span></div>
    <div class="atlas-legend"><span><i />省级汇总光柱</span><span><i class="gold" />{{ hasDemoLocations ? '站点位置（含演示示意）' : '已录入坐标站点' }}</span></div>
    <div class="atlas-foot">{{ ready ? '立体视图 · 移动指针查看省级统计' : '二维地图模式' }}<span>行政区划：DataV</span></div>
    <div v-if="hover" class="atlas-tooltip">{{ hover }}</div>
  </div>
</template>
<script>
import { loadThree } from '@/utils/three-runtime'
import StationMap from './StationMap'
import { createAtlas } from './atlas'
export default {
  name: 'AtlasScene',
  components: { StationMap },
  props: { stations: { type: Array, default: () => [] }, motion: { type: Boolean, default: true }},
  data() { return { ready: false, hover: '' } },
  computed: { hasDemoLocations() { return this.stations.some(station => station.coordinateSource === 'DEMO') } },
  watch: { stations() { if (this.atlas) this.atlas.update(this.stations) }, motion(value) { if (this.atlas) this.atlas.setMotion(value) } },
  mounted() { this.initialize() },
  beforeDestroy() { this.cancelled = true; if (this.atlas) this.atlas.dispose() },
  methods: {
    async initialize() {
      try {
        const [T, geo] = await Promise.all([loadThree(), fetch(process.env.BASE_URL + 'maps/china.json').then(r => { if (!r.ok) throw new Error('map'); return r.json() })])
        if (this.cancelled) return
        this.atlas = createAtlas(this.$refs.stage, T, geo, text => { this.hover = text }, () => { this.ready = false; if (this.atlas) this.atlas.dispose() })
        this.atlas.update(this.stations)
        this.atlas.setMotion(this.motion)
        this.ready = true
      } catch (error) { this.ready = false }
    }
  }
}
</script>
<style scoped>
.atlas-scene{position:relative;width:100%;height:100%;min-height:360px;overflow:hidden;background:radial-gradient(ellipse at 50% 65%,#0c426641,transparent 65%)}.atlas-stage{position:absolute;inset:0}.atlas-stage ::v-deep canvas{display:block;width:100%;height:100%;outline:none}.atlas-fallback{position:absolute;inset:0}.atlas-label{position:absolute;left:22px;top:20px;display:flex;gap:10px;color:#5494b3;font:9px Consolas,monospace;letter-spacing:2px;pointer-events:none}.atlas-label b{display:block;color:#b6e8f3;font-size:12px;letter-spacing:3px;margin-top:6px}.atlas-cross{font:30px Consolas;color:#27c8e8}.atlas-legend{position:absolute;bottom:40px;left:22px;display:flex;flex-direction:column;gap:9px;font-size:10px;color:#719ab3;pointer-events:none}.atlas-legend i{display:inline-block;width:5px;height:5px;background:#22e4ed;margin-right:8px;box-shadow:0 0 8px #22e4ed}.atlas-legend i.gold{background:#f7bf62;box-shadow:0 0 8px #f7bf62}.atlas-foot{position:absolute;bottom:13px;left:22px;right:22px;display:flex;justify-content:space-between;font-size:9px;letter-spacing:1px;color:#477a98;pointer-events:none}.atlas-tooltip{position:absolute;top:22px;right:22px;background:#06233ce8;border:1px solid #24bbd6;padding:9px 13px;color:#bffaff;font-size:12px;pointer-events:none}
</style>
