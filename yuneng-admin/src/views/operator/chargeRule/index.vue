<template>
  <div class="app-container">
    <el-alert title="规则仅影响新启动；启用白名单且名单为空时，所有会员均不可新启动。" type="info" :closable="false" />
    <el-form v-if="isRoot" inline class="rule-target">
      <el-form-item label="运营商编码"><el-input v-model="targetInput" placeholder="留空管理当前租户" /></el-form-item>
      <el-button @click="selectTarget">加载</el-button>
    </el-form>
    <el-form v-if="rule" label-width="140px" class="rule-form">
      <el-form-item label="运营商编码">{{ rule.tenant_id }}</el-form-item>
      <el-form-item label="最长充电时长"><el-input-number v-model="hours" :min="1" :max="24" /> 小时</el-form-item>
      <el-form-item label="仅白名单启充"><el-switch v-model="enabled" /></el-form-item>
      <el-form-item><el-button v-hasPermi="['operator:chargeRule:edit']" type="primary" :loading="saving" @click="save">保存规则</el-button><el-button @click="load">刷新</el-button></el-form-item>
    </el-form>
    <template v-if="rule">
      <h3>充电白名单</h3>
      <el-input v-model="memberId" placeholder="输入本运营商会员ID" class="member-input" />
      <el-button v-hasPermi="['operator:chargeRule:edit']" :disabled="saving" @click="add">添加会员</el-button>
      <el-table :data="rule.members" class="member-table">
        <el-table-column prop="member_id" label="会员ID" />
        <el-table-column prop="user_name" label="会员名称" />
        <el-table-column label="操作"><template slot-scope="scope"><el-button v-hasPermi="['operator:chargeRule:edit']" type="text" :disabled="saving" @click="remove(scope.row.member_id)">移除</el-button></template></el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script>
import { getRule, saveRule, addMember, removeMember } from '@/api/operator/chargeRule'
export default {
  name: 'OperatorChargeRule',
  data() { return { rule: null, hours: 24, enabled: false, memberId: '', targetInput: '', target: undefined, saving: false } },
  computed: { isRoot() { return Number(this.$store.getters.userId) === 1 } },
  created() { this.load() },
  methods: {
    selectTarget() {
      if (this.targetInput && !/^[1-9]\d*$/.test(this.targetInput)) return this.$modal.msgError('运营商编码无效')
      this.target = this.targetInput || undefined
      this.rule = null
      this.load()
    },
    load() {
      return getRule(this.target).then(({ data }) => { this.rule = data; this.hours = data.max_charging_hours; this.enabled = data.whitelist_enabled === 1 })
    },
    async mutate(action) {
      if (this.saving) return
      this.saving = true
      try { await action(); this.$modal.msgSuccess('配置已更新'); await this.load() } finally { this.saving = false }
    },
    save() { this.mutate(() => saveRule({ targetTenantId: this.target, maxChargingHours: this.hours, whitelistEnabled: this.enabled, version: this.rule.version })) },
    add() {
      if (!/^[1-9]\d*$/.test(this.memberId)) return this.$modal.msgError('请输入有效会员ID')
      this.mutate(() => addMember({ targetTenantId: this.target, memberId: this.memberId, version: this.rule.version }))
    },
    remove(memberId) { this.mutate(() => removeMember({ targetTenantId: this.target, memberId, version: this.rule.version })) }
  }
}
</script>

<style scoped>
.rule-target, .rule-form { margin-top: 20px; }
.member-input { width: 260px; margin-right: 12px; }
.member-table { margin-top: 16px; }
</style>
