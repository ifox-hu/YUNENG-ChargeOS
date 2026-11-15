<template>
  <div class="ec-stage" aria-label="可拖拽旋转和缩放的三维能量装置">
    <div class="ec-fallback" aria-hidden="true" />
    <button
      type="button"
      class="ec-core-hit"
      aria-label="拖拽旋转，滚轮或双指缩放，点击触发能量反馈；方向键旋转，Home 恢复视角"
    />
  </div>
</template>

<script>
import { loadThree, createEnergyScene } from './scene'

export default {
  name: 'EnergyScene',
  props: {
    focused: { type: Boolean, default: false },
    busy: { type: Boolean, default: false }
  },
  watch: {
    focused(value) { if (this.energyScene) this.energyScene.setFocused(value) },
    busy(value) { if (this.energyScene) this.energyScene.setBusy(value) }
  },
  mounted() {
    this.sceneCancelled = false
    loadThree().then(three => {
      if (this.sceneCancelled) return
      this.energyScene = createEnergyScene(this.$el, three, status => this.$emit('status', status))
      this.energyScene.setFocused(this.focused)
      this.energyScene.setBusy(this.busy)
    }).catch(() => {
      if (!this.sceneCancelled) this.$emit('status', '能量核心 · 静态展示')
    })
  },
  beforeDestroy() {
    this.sceneCancelled = true
    if (this.energyScene) this.energyScene.dispose()
  },
  methods: {
    complete() {
      return this.energyScene ? this.energyScene.complete() : Promise.resolve()
    },
    pulse() {
      if (this.energyScene) this.energyScene.pulse()
    }
  }
}
</script>
