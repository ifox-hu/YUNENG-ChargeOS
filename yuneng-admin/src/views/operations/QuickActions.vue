<template>
  <nav v-if="items.length" class="dashboard-shortcuts" aria-label="常用功能">
    <router-link v-for="item in items" :key="item.key" :to="item.to" class="shortcut-card" :data-shortcut="item.key">
      <span class="shortcut-icon" :class="{ 'has-pending': item.key==='faults' && pending>0 }" aria-hidden="true"><i :class="item.icon" /></span>
      <span class="shortcut-copy"><strong>{{ item.title }}<span v-if="item.key==='faults' && pending>0" class="shortcut-badge" :aria-label="pending+' 项待处理'">{{ pending>99?'99+':pending }}</span></strong><small>{{ item.description }}</small></span>
      <i class="el-icon-arrow-right shortcut-arrow" aria-hidden="true" />
    </router-link>
  </nav>
</template>
<script>
export default {
  name: 'DashboardQuickActions',
  props: { scope: { type: Object, required: true }, dates: { type: Array, required: true }, permissions: { type: Array, default: () => [] }, canFault: Boolean, pending: { type: Number, default: 0 }},
  computed: {
    items() {
      const query = {}
      if (this.scope.tenantId) query.tenantId = String(this.scope.tenantId)
      if (this.scope.stationId) query.stationId = String(this.scope.stationId)
      const permitted = permission => this.permissions.includes('*:*:*') || this.permissions.includes(permission)
      return [
        { key: 'orders', title: '充电订单', description: '查看当前范围订单', icon: 'el-icon-document', permission: 'operator:order:list', to: { path: '/operate/order', query: { ...query, startDate: this.dates[0], endDate: this.dates[1] }}},
        { key: 'faults', title: '故障处理', description: '跟进未关闭工单', icon: 'el-icon-warning-outline', permission: 'operator:fault:list', to: { path: '/operate/fault', query: { ...query, activeOnly: 'true' }}},
        { key: 'map', title: '桩分布', description: '查看站点地理分布', icon: 'el-icon-location-outline', permission: 'operator:station:list', to: { path: '/operations/map', query: { ...query }}},
        { key: 'screen', title: '数据大屏', description: '进入全屏运营视图', icon: 'el-icon-full-screen', permission: 'operator:station:list', to: { path: '/operations/screen', query: { ...query }}}
      ].filter(item => permitted(item.permission) && (item.key !== 'faults' || this.canFault))
    }
  }
}
</script>
<style scoped>
.dashboard-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.shortcut-card{display:flex;align-items:center;gap:12px;min-width:0;min-height:76px;padding:14px 16px;background:#fff;border:1px solid #e1e8f3;border-radius:8px;color:#23334e;transition:border-color .16s,background-color .16s}.shortcut-card:hover{border-color:#a8c3fa;background:#fafdff}.shortcut-card:focus-visible{outline:2px solid #2563eb;outline-offset:3px}.shortcut-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#edf3ff;color:#3477ed;font-size:21px}.shortcut-icon.has-pending{background:#fff5e7;color:#c88423}.shortcut-copy{min-width:0;flex:1}.shortcut-copy strong{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;line-height:20px}.shortcut-copy small{display:block;margin-top:4px;font-size:11px;line-height:16px;color:#8b98ac}.shortcut-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#fff1dc;color:#b76c0b;font-size:11px;font-weight:500}.shortcut-arrow{color:#9aabc3;font-size:12px;flex-shrink:0}
@media(max-width:1100px){.dashboard-shortcuts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.dashboard-shortcuts{gap:10px}.shortcut-card{padding:12px 10px;gap:8px;min-height:76px}.shortcut-icon{width:30px;height:30px;border-radius:8px;font-size:18px}.shortcut-copy strong{font-size:13px;gap:4px}.shortcut-copy small{font-size:10px}.shortcut-arrow{display:none}}
@media(prefers-reduced-motion:reduce){.shortcut-card{transition:none}}
</style>
