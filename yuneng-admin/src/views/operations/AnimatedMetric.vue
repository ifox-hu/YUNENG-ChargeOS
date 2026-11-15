<template><span class="animated-metric"><count-to v-if="valid" :start-val="start" :end-val="Number(value)" :duration="animate ? 1100 : 0" :decimals="digits" separator="," /><span v-else>—</span></span></template>
<script>
import CountTo from 'vue-count-to'
export default {
  name: 'AnimatedMetric', components: { CountTo },
  props: { value: { type: [Number, String], default: null }, digits: { type: Number, default: 0 }, motion: { type: Boolean, default: true }},
  data() { return { start: 0, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches } },
  computed: { valid() { return this.value != null && this.value !== '' && Number.isFinite(Number(this.value)) }, animate() { return this.motion && !this.reduced } },
  watch: { value(value, old) { this.start = Number.isFinite(Number(old)) ? Number(old) : 0 } }
}
</script>
