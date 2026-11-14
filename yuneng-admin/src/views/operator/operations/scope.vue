<template>
  <div class="operation-scope">
    <span class="scope-note">{{ sampleId ? '示例预览：图表和指标来自展示样本，不写入实际业务' : note }}</span>
    <el-form v-if="samples.length" inline class="sample-form" @submit.native.prevent>
      <el-form-item label="运营商视图">
        <el-select :value="sampleId" size="small" class="sample-selector" @change="$emit('sample-change', $event)">
          <el-option label="当前运营商数据" value="" />
          <el-option v-for="row in samples" :key="row.id" :label="row.name" :value="row.id" />
        </el-select>
      </el-form-item>
      <span v-if="sampleId" class="sample-hint">选择“当前运营商数据”可返回原业务数据</span>
    </el-form>
    <el-form v-if="isRoot && !sampleId" inline class="scope-form" @submit.native.prevent="apply">
      <el-form-item label="运营商编码"><el-input v-model="target" clearable placeholder="留空查看当前运营商" size="small" /></el-form-item>
      <el-form-item><el-button size="small" @click="apply">切换运营商</el-button></el-form-item>
    </el-form>
  </div>
</template>
<script>
export default {
  name: 'OperationScope',
  props: { value: { type: [String, Number], default: '' }, samples: { type: Array, default: () => [] }, sampleId: { type: String, default: '' }, note: { type: String, default: '本地模拟：收退款及分账仅记入本地余额与台账' } },
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
.sample-form .el-form-item { margin-bottom: 10px; }
.sample-selector { width: 290px; max-width: 100%; }
.sample-hint { color: #909399; font-size: 12px; line-height: 32px; }
.scope-form { margin-top: 0; }
.scope-form .el-form-item { margin-bottom: 0; }
</style>
