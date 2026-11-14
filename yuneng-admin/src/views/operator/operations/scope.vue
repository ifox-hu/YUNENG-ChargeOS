<template>
  <div class="operation-scope">
    <span class="scope-note">本地模拟：收退款及分账仅记入本地余额与台账</span>
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
.operation-scope { margin-bottom: 16px; }
.scope-note { display: block; color: #909399; font-size: 12px; margin-bottom: 12px; }
.scope-form { margin-top: 0; }
.scope-form .el-form-item { margin-bottom: 0; }
</style>
