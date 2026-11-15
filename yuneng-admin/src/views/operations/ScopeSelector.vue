<template>
  <div class="scope-selector" :class="{ 'scope-dark': dark }" data-testid="overview-scope">
    <label v-if="scope.root"><span>运营商</span><el-select :value="scope.tenantId || ''" filterable size="small" aria-label="选择运营商" @change="operatorChanged"><el-option label="全部运营商" value="" /><el-option v-for="item in operators" :key="item.id" :label="item.name" :value="item.id" /></el-select></label>
    <span v-else class="scope-identity"><i class="el-icon-office-building" /> 本运营商</span>
    <i class="el-icon-arrow-right scope-arrow" />
    <label><span>站点</span><el-select :value="scope.stationId || ''" filterable size="small" aria-label="选择站点" @change="stationChanged"><el-option label="全部站点" value="" /><el-option v-for="item in stations" :key="item.stationId" :label="item.stationName" :value="item.stationId" /></el-select></label>
    <slot />
    <span v-if="!compact" class="scope-count">{{ stations.length }} 个可见站点</span>
  </div>
</template>
<script>
export default {
  name: 'ScopeSelector',
  props: { scope: { type: Object, required: true }, operators: { type: Array, default: () => [] }, stations: { type: Array, default: () => [] }, dark: Boolean, compact: Boolean },
  methods: {
    operatorChanged(tenantId) { this.$emit('change', { tenantId, stationId: null }) },
    stationChanged(stationId) { this.$emit('change', { tenantId: this.scope.tenantId, stationId }) }
  }
}
</script>
<style scoped>
.scope-selector { display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:15px 18px;background:#fff;border:1px solid #e1e8f3;border-radius:8px;margin-bottom:20px;font-size:12px; }
label { display:flex;align-items:center;gap:10px; }label > span,.scope-identity { color:#536b8b;font-weight:600; }.scope-arrow,.scope-count { color:#8597af; }.scope-count { margin-left:auto; }.el-select { width:220px; }.scope-dark { border-color:#155276;background:#071b31bd;border-radius:0;margin:0; }.scope-dark label > span,.scope-dark .scope-identity { color:#8fcef0; }.scope-dark .scope-count { color:#5999bd; }.scope-dark ::v-deep .el-input__inner { color:#d0f5ff;background:#09243c;border-color:#1a5b7b; }.scope-dark ::v-deep .el-input__inner:focus { border-color:#28dbff; }
@media(max-width:650px){.scope-selector{gap:10px;padding:12px}.el-select{width:180px}.scope-count{display:none}.scope-arrow{display:none}}
</style>
