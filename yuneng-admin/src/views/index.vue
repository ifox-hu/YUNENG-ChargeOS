<template>
  <operations-overview v-if="canView" /><el-empty v-else description="当前账号尚未授权经营仪表盘，请从菜单进入已授权业务" />
</template>

<script>
import OperationsOverview from '@/views/operator/operations/overview'
export default { name: 'Index', components: { OperationsOverview }, computed: { canView() { const permissions = this.$store.getters.permissions || []; return permissions.includes('*:*:*') || permissions.includes('operator:operations:view') } }}
</script>
