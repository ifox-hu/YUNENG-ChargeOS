<template>
  <div :class="embedded ? 'embedded-operations' : 'app-container'">
    <operation-scope v-model="target" @change="changeTenant" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-hasPermi="['operator:operations:write']" type="primary" size="small" icon="el-icon-plus" @click="create">新建满减券</el-button>
    <el-button size="small" icon="el-icon-refresh" @click="load">刷新</el-button>
    <el-table v-loading="loading" :data="report.records" border class="data-table">
      <el-table-column prop="name" label="券名称" min-width="150" /><el-table-column prop="threshold_amount" label="使用门槛 / 元" /><el-table-column prop="discount_amount" label="优惠 / 元" /><el-table-column label="已发 / 总量（张）"><template slot-scope="scope">{{ scope.row.issued_count }} / {{ scope.row.total_count }}</template></el-table-column><el-table-column prop="valid_from" label="开始时间" min-width="160" /><el-table-column prop="valid_to" label="截止时间" min-width="160" /><el-table-column label="状态" width="90"><template slot-scope="scope"><el-tag :type="Number(scope.row.enabled) ? 'success' : 'info'">{{ Number(scope.row.enabled) ? '可发放' : '已停发' }}</el-tag></template></el-table-column><el-table-column label="操作" width="170"><template slot-scope="scope"><el-button v-hasPermi="['operator:operations:write']" type="text" :disabled="saving" @click="issue(scope.row)">向会员发放</el-button><el-button v-hasPermi="['operator:operations:write']" type="text" :disabled="saving" @click="toggle(scope.row)">{{ Number(scope.row.enabled) ? '停发' : '启用' }}</el-button></template></el-table-column>
    </el-table>
    <pagination v-show="report.total > 0" :total="report.total" :page.sync="page" :limit.sync="size" @pagination="load" />
    <h3>会员优惠券（最近100条）</h3><el-form inline size="small"><el-form-item label="会员ID"><el-input v-model="member" clearable placeholder="留空查询最近发放" /></el-form-item><el-button @click="load">查询</el-button></el-form>
    <el-table :data="report.coupons" border><el-table-column prop="id" label="券ID" width="100" /><el-table-column prop="name" label="名称" /><el-table-column prop="member_id" label="会员ID" /><el-table-column label="状态"><template slot-scope="scope"><el-tag :type="scope.row.status === 'USED' ? 'warning' : Number(scope.row.in_date) ? 'success' : 'info'">{{ scope.row.status === 'USED' ? '已使用' : Number(scope.row.in_date) ? '未使用' : '非有效期' }}</el-tag></template></el-table-column><el-table-column prop="used_order_id" label="核销订单" min-width="200" /><el-table-column prop="valid_to" label="有效期至" min-width="160" /></el-table>
    <el-dialog title="新建满减券" :visible.sync="visible" width="530px"><el-form label-width="100px"><el-form-item label="名称"><el-input v-model="form.name" :maxlength="60" /></el-form-item><el-form-item label="使用门槛"><el-input-number v-model="form.thresholdAmount" :min="0.01" :precision="2" /> 元</el-form-item><el-form-item label="优惠金额"><el-input-number v-model="form.discountAmount" :min="0.01" :precision="2" /> 元</el-form-item><el-form-item label="发行数量"><el-input-number v-model="form.totalCount" :min="1" :max="100000" :precision="0" /></el-form-item><el-form-item label="开始时间"><el-date-picker v-model="form.validFrom" type="datetime" value-format="yyyy-MM-dd HH:mm:ss" /></el-form-item><el-form-item label="结束时间"><el-date-picker v-model="form.validTo" type="datetime" value-format="yyyy-MM-dd HH:mm:ss" /></el-form-item></el-form><el-alert title="每单限一张，全额退款后恢复券但不延长有效期；停发不影响已发放券使用。" type="info" :closable="false" /><span slot="footer"><el-button type="primary" :loading="saving" @click="save">创建模板</el-button></span></el-dialog>
  </div>
</template>
<script>
import OperationScope from './scope'
import { getOperations, saveOperation, operationKey } from '@/api/operator/operations'
export default {
  name: 'OperationsMarketing', components: { OperationScope }, props: { embedded: Boolean },
  data() { return { target: this.$route.query.targetTenantId || '', member: '', page: 1, size: 10, report: { records: [], coupons: [], total: 0 }, sequence: 0, context: 0, confirming: false, loading: false, saving: false, error: '', visible: false, form: {}} },
  created() { this.load() },
  beforeDestroy() { this.closeDialogs() },
  deactivated() { this.closeDialogs() },
  methods: {
    closeDialogs() {
      this.context++
      if (this.confirming) this.$msgbox.close()
      this.confirming = false
      this.visible = false
    },
    changeTenant() { this.context++; this.page = 1; this.report = { records: [], coupons: [], total: 0 }; this.visible = false; this.form = {}; this.member = ''; this.load() },
    params(extra) { return { targetTenantId: this.target || undefined, ...extra } },
    async load() { const sequence = ++this.sequence; if (this.member && !/^[1-9]\d*$/.test(this.member)) return this.$message.warning('会员ID格式无效'); this.loading = true; this.error = ''; try { const { data } = await getOperations('coupons', this.params({ memberId: this.member || undefined, page: this.page, size: this.size })); if (sequence !== this.sequence) return; this.report = data } catch (error) { if (sequence === this.sequence) { this.report = { records: [], coupons: [], total: 0 }; this.error = '优惠券加载失败，请重试' } } finally { if (sequence === this.sequence) this.loading = false } },
    create() { this.form = { name: '', thresholdAmount: 20, discountAmount: 5, totalCount: 100, validFrom: '', validTo: '' }; this.visible = true },
    async mutate(path, data) { if (this.saving) return; this.saving = true; try { await saveOperation(path, this.params(data)); this.$message.success('操作成功'); await this.load(); return true } finally { this.saving = false } },
    async save() { if (!this.form.name.trim() || !this.form.validFrom || !this.form.validTo) return this.$message.warning('请填写名称和有效期'); if (await this.mutate('coupon', this.form)) this.visible = false },
    toggle(row) { return this.mutate('coupon', { templateId: row.id, enabled: !Number(row.enabled) }) },
    async issue(row) {
      const context = this.context
      this.confirming = true
      try {
        const { value } = await this.$prompt('输入本运营商会员ID，每次确认发放一张', '发放 ' + row.name, { inputPattern: /^[1-9]\d*$/, inputErrorMessage: '请输入有效会员ID' })
        if (context !== this.context) return
        await this.mutate('coupon/issue', { templateId: row.id, memberId: Number(value), requestId: operationKey() })
      } catch (error) { if (error !== 'cancel' && error !== 'close') throw error } finally { this.confirming = false }
    }
  }
}
</script>
<style scoped>.data-table { margin-top: 18px; } h2 { color: #26344f; } h3 { margin-top: 30px; }</style>
