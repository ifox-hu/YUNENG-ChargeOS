<template>
  <div :class="embedded ? 'embedded-operations' : 'app-container'">

    <template v-if="!actionsOnly">
      <operation-scope v-model="target" @change="changeTenant" />
      <el-form inline size="small">
        <el-form-item><el-input v-model="keyword" clearable placeholder="订单号 / 充电桩编号" @keyup.enter.native="search" /></el-form-item>
        <el-form-item><el-button icon="el-icon-search" type="primary" @click="search">查询</el-button></el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-loading="loading" :data="rows" border empty-text="当前条件暂无订单">
        <el-table-column prop="order_number" label="订单号" min-width="210" show-overflow-tooltip />
        <el-table-column prop="station_name" label="站点" min-width="130" />
        <el-table-column prop="user_id" label="会员" width="85" />
        <el-table-column label="订单状态" width="100"><template slot-scope="scope">{{ stateNames[scope.row.order_state] || scope.row.order_state }}</template></el-table-column>
        <el-table-column label="结算 / 元" width="105" align="right"><template slot-scope="scope">{{ money(scope.row.ordergold) }}</template></el-table-column>
        <el-table-column label="实付 / 已退" width="140" align="right"><template slot-scope="scope">{{ scope.row.payment_id ? money(scope.row.paid_amount) + ' / ' + money(scope.row.refunded_amount) : '未纳入本地收款' }}</template></el-table-column>
        <el-table-column label="核查项" min-width="145"><template slot-scope="scope"><el-tag v-if="scope.row.exception_type" type="warning" size="small">{{ exceptionNames[scope.row.exception_type] }}</el-tag><span v-else>—</span></template></el-table-column>
        <el-table-column label="操作" width="210" fixed="right"><template slot-scope="scope"><el-button type="text" @click="detail(scope.row)">详情</el-button><el-button v-hasPermi="['operator:operations:write']" type="text" @click="handle(scope.row)">核查</el-button><el-button v-if="!scope.row.payment_id && ['3','5','7'].includes(String(scope.row.order_state))" v-hasPermi="['operator:operations:write']" type="text" @click="openPay(scope.row)">本地付款</el-button><el-button v-if="scope.row.payment_id && Number(scope.row.paid_amount) > Number(scope.row.refunded_amount)" v-hasPermi="['operator:operations:write']" type="text" @click="openRefund(scope.row)">退款</el-button><el-button v-if="scope.row.payment_id && Number(scope.row.paid_amount) === 0 && scope.row.payment_status === 'PAID'" v-hasPermi="['operator:operations:write']" type="text" @click="voidZero(scope.row)">撤销核销</el-button></template></el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" :page.sync="page" :limit.sync="size" @pagination="load" />
    </template>
    <el-dialog title="订单结算与退款" :visible.sync="fundsVisible" width="640px">
      <template v-if="record"><el-descriptions :column="2" border size="small"><el-descriptions-item label="订单号">{{ record.order.order_number }}</el-descriptions-item><el-descriptions-item label="会员">{{ record.order.user_id }}</el-descriptions-item><el-descriptions-item label="结算金额">{{ money(record.order.ordergold) }} 元</el-descriptions-item><el-descriptions-item label="收款状态">{{ record.order.payment_id ? '已纳入本地收款' : '未纳入本地收款' }}</el-descriptions-item><el-descriptions-item label="实付">{{ money(record.order.paid_amount) }} 元</el-descriptions-item><el-descriptions-item label="已退">{{ money(record.order.refunded_amount) }} 元</el-descriptions-item></el-descriptions><p class="funds-note">付款、退款仅操作本地余额；历史结算记录不等于已扣款。</p><div v-hasPermi="['operator:operations:write']"><el-button v-if="!record.order.payment_id && ['3','5','7'].includes(String(record.order.order_state))" type="primary" size="small" @click="openPay(record.order)">本地付款</el-button><el-button v-if="record.order.payment_id && Number(record.order.paid_amount) > Number(record.order.refunded_amount)" type="primary" size="small" @click="openRefund(record.order)">退款</el-button><el-button v-if="record.order.payment_id && Number(record.order.paid_amount) === 0 && record.order.payment_status === 'PAID'" size="small" @click="voidZero(record.order)">撤销核销</el-button></div></template>
    </el-dialog>
    <el-dialog :title="mode === 'pay' ? '本地余额付款' : '本地退款'" :visible.sync="paymentVisible" width="500px">
      <el-alert :title="mode === 'pay' ? '将从订单所属会员的本地余额扣款；不产生真实支付。' : '仅退还实际本地扣款，历史结算金额不能直接退款。'" type="warning" :closable="false" />
      <el-form label-width="100px" class="dialog-form">
        <el-form-item label="订单号">{{ selected.order_number }}</el-form-item>
        <el-form-item v-if="mode === 'pay'" label="优惠券"><el-select v-model="couponId" clearable placeholder="不使用优惠券"><el-option v-for="coupon in coupons" :key="coupon.id" :value="coupon.id" :label="coupon.name + ' · 满' + coupon.threshold_amount + '减' + coupon.discount_amount" /></el-select></el-form-item>
        <el-form-item v-else label="退款金额"><el-input-number v-model="amount" :min="0.01" :max="Math.max(0.01, Number(selected.paid_amount) - Number(selected.refunded_amount))" :precision="2" /></el-form-item>
        <el-form-item v-if="mode === 'refund'" label="退款原因"><el-input v-model="reason" type="textarea" :maxlength="255" /></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="paymentVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submitPayment">确认{{ mode === 'pay' ? '付款' : '退款' }}</el-button></span>
    </el-dialog>
    <el-dialog title="订单明细与处理记录" :visible.sync="detailVisible" width="760px">
      <template v-if="record"><el-descriptions :column="2" border><el-descriptions-item label="订单号">{{ record.order.order_number }}</el-descriptions-item><el-descriptions-item label="会员">{{ record.order.user_id }}</el-descriptions-item><el-descriptions-item label="开始">{{ record.order.start_time }}</el-descriptions-item><el-descriptions-item label="结束">{{ record.order.end_time || '未结束' }}</el-descriptions-item><el-descriptions-item label="停止原因">{{ record.order.stop_reason || '—' }}</el-descriptions-item><el-descriptions-item label="电量">{{ record.order.consume_power || 0 }} kWh</el-descriptions-item></el-descriptions><h4>充电日志</h4><el-table :data="record.logs" size="small"><el-table-column prop="create_time" label="时间" /><el-table-column prop="log_content" label="内容" /></el-table><h4>核查记录（备注不会自动消除异常）</h4><el-table :data="record.handling" size="small"><el-table-column prop="action" label="动作" width="100" /><el-table-column prop="note" label="说明" /><el-table-column prop="actor_id" label="处理人" width="90" /></el-table></template>
    </el-dialog>
    <el-dialog title="异常核查与留痕" :visible.sync="handleVisible" width="480px"><el-form label-width="90px"><el-form-item label="处理动作"><el-select v-model="action"><el-option value="NOTE" label="补充处理说明" /><el-option value="RECHECK" label="重新核查并留痕" /></el-select></el-form-item><el-form-item label="处理说明"><el-input v-model="reason" type="textarea" :maxlength="255" /></el-form-item></el-form><el-alert title="当前仅支持核查与留痕；启停结果须经原流程确认，不能直接取消预占订单或强制结算。" type="info" :closable="false" /><span slot="footer"><el-button type="primary" :loading="saving" @click="submitHandling">保存处理记录</el-button></span></el-dialog>
  </div>
</template>
<script>
import OperationScope from './scope'
import { getOperations, saveOperation, operationKey, formatMoney } from '@/api/operator/operations'
export default {
  name: 'OperationsOrders', components: { OperationScope }, props: { embedded: Boolean, actionsOnly: Boolean, exceptionsOnly: Boolean },
  data() {
    return { target: this.$route.query.targetTenantId || '', exceptions: this.exceptionsOnly || this.$route.query.exceptions === 'true', keyword: '', page: 1, size: 10, total: 0, rows: [], sequence: 0, context: 0, confirming: false, loading: false, error: '', saving: false, selected: {}, mode: '', couponId: null, coupons: [], amount: 0.01, reason: '', requestId: '', fundsVisible: false, paymentVisible: false, detailVisible: false, handleVisible: false, record: null, action: 'NOTE',
      stateNames: { 1: '下单', 2: '取消', 3: '结算完成（旧状态）', 4: '已退款', 5: '已完成', 6: '结算中', 7: '手动结算' }, exceptionNames: { START_UNCERTAIN: '启充待确认', LONG_RUNNING: '长期未结束', SETTLEMENT_TIMEOUT: '结算超时', AMOUNT_MISMATCH: '费用不一致', INCOMPLETE_END: '结束信息不完整' }}
  },
  created() { if (!this.actionsOnly) this.load() },
  beforeDestroy() { this.closeDialogs() },
  deactivated() { this.closeDialogs() },
  methods: {
    money: formatMoney,
    closeDialogs() {
      this.context++
      if (this.confirming) this.$msgbox.close()
      this.confirming = false
      this.fundsVisible = false; this.paymentVisible = false; this.detailVisible = false; this.handleVisible = false
    },
    async openFunds(row) {
      this.target = row.tenantId ? String(row.tenantId) : ''
      this.paymentVisible = false
      this.fundsVisible = false
      this.record = null
      const context = ++this.context
      const { data } = await getOperations('orders/' + encodeURIComponent(row.orderId), this.params())
      if (context !== this.context) return
      this.record = data
      this.fundsVisible = true
    },
    async refreshFunds() {
      const context = this.context
      const target = this.target
      if (this.fundsVisible && this.record) {
        const { data } = await getOperations('orders/' + encodeURIComponent(this.record.order.order_id), this.params())
        if (context !== this.context || target !== this.target) return
        this.record = data
      }
      this.$emit('updated')
    },
    changeTenant() { this.context++; this.fundsVisible = false; this.paymentVisible = false; this.detailVisible = false; this.handleVisible = false; this.selected = {}; this.record = null; this.coupons = []; this.keyword = ''; this.rows = []; this.search() },
    params(extra) { return { targetTenantId: this.target || undefined, ...extra } },
    search() { this.page = 1; this.load() },
    async load() { const sequence = ++this.sequence; this.loading = true; this.error = ''; try { const { data } = await getOperations('orders', this.params({ exceptions: this.exceptions, keyword: this.keyword, page: this.page, size: this.size })); if (sequence !== this.sequence) return; this.rows = data.records; this.total = data.total } catch (error) { if (sequence === this.sequence) { this.rows = []; this.total = 0; this.error = '订单加载失败，请重试' } } finally { if (sequence === this.sequence) this.loading = false } },
    async detail(row) { const context = ++this.context; const target = this.target; const { data } = await getOperations('orders/' + encodeURIComponent(row.order_id), this.params()); if (context !== this.context || target !== this.target) return; this.record = data; this.detailVisible = true },
    async openPay(row) {
      const context = ++this.context
      const target = this.target
      this.selected = row; this.couponId = null; this.coupons = []; this.mode = 'pay'; this.requestId = operationKey()
      const permissions = this.$store.getters.permissions || []
      if (permissions.includes('*:*:*') || permissions.includes('operator:operations:marketing')) {
        const { data } = await getOperations('coupons', this.params({ memberId: row.user_id }))
        if (context !== this.context || target !== this.target) return
        this.coupons = data.coupons.filter(coupon => coupon.status === 'UNUSED' && Number(coupon.in_date) === 1 && Number(coupon.threshold_amount) <= Number(row.ordergold))
      }
      this.paymentVisible = true
    },
    openRefund(row) { this.selected = row; this.mode = 'refund'; this.reason = ''; this.amount = Number((Number(row.paid_amount) - Number(row.refunded_amount)).toFixed(2)); this.requestId = operationKey(); this.paymentVisible = true },
    async submitPayment() { if (this.saving) return; if (this.mode === 'refund' && !this.reason.trim()) return this.$message.warning('请填写退款原因'); this.saving = true; try { await saveOperation(this.mode, this.params({ orderId: this.selected.order_id, requestId: this.requestId, couponId: this.couponId || null, amount: this.amount, reason: this.reason })); this.paymentVisible = false; this.$message.success('本地账务操作成功'); if (!this.actionsOnly) await this.load(); await this.refreshFunds() } finally { this.saving = false } },
    handle(row) { this.selected = row; this.reason = ''; this.action = 'NOTE'; this.handleVisible = true },
    async submitHandling() { if (!this.reason.trim()) return this.$message.warning('请填写处理说明'); this.saving = true; try { await saveOperation('exception/action', this.params({ orderId: this.selected.order_id, action: this.action, reason: this.reason })); this.handleVisible = false; await this.load() } finally { this.saving = false } },
    async voidZero(row) {
      const context = this.context
      this.confirming = true
      try {
        const { value } = await this.$prompt('填写撤销原因；恢复优惠券但不增加余额', '撤销零实付核销', { inputValidator: value => !!value && value.length <= 255 })
        if (context !== this.context) return
        await saveOperation('void', this.params({ orderId: row.order_id, reason: value }))
        if (!this.actionsOnly) await this.load()
        await this.refreshFunds()
      } catch (error) { if (error !== 'cancel' && error !== 'close') throw error } finally { this.confirming = false }
    }
  }
}
</script>
<style scoped>.dialog-form { margin-top: 20px; } .funds-note { color: #909399; font-size: 12px; }</style>
