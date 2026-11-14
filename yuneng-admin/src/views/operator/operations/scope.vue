<template>
  <div class="operation-scope">
    <el-alert title="本地业务环境 · 付款、退款和分账仅操作本地余额及台账，不调用真实支付渠道。" type="info" :closable="false" show-icon />
    <el-form v-if="isRoot" inline class="scope-form" @submit.native.prevent="apply">
      <el-form-item label="运营商编码"><el-input v-model="target" clearable placeholder="留空查看当前运营商" size="small" /></el-form-item>
      <el-form-item><el-button size="small" @click="apply">切换运营商</el-button></el-form-item>
    </el-form>
  </div>
</template>
<script>
export default {
  name: 'OperationScope',
  props: { value: { type: [String, Number], default: '' }},
  data() { return { target: this.value } },
  computed: { isRoot() { return Number(this.$store.getters.userId) === 1 } },
  methods: {
    apply() {
      if (this.target && !/^[1-9]\d*$/.test(String(this.target))) return this.$message.error('请输入有效的运营商编码')
      this.$emit('input', this.target || '')
      this.$emit('change')
    }
  }
}
</script>
<style scoped>
.operation-scope { margin-bottom: 20px; }
.scope-form { margin-top: 14px; }
.scope-form .el-form-item { margin-bottom: 0; }
</style>
