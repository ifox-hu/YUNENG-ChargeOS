<template>
  <el-card class="alarm-events" shadow="never" data-testid="alarm-events">
    <div slot="header" class="alarm-header">
      <div><h3>告警事件</h3><span class="muted">持久接收 · 异步关联工单 · 失败可重放</span></div>
      <el-button v-hasPermi="['operator:fault:add']" type="primary" plain @click="newAlarm">新建异步告警</el-button>
    </div>
    <el-alert v-if="demoMode" title="静态演示：告警与工单仅保存在当前浏览器，不连接后端、RocketMQ 或真实设备。提交后稍候刷新可查看模拟处理结果。" type="info" :closable="false" show-icon />
    <el-form :inline="true" :model="query">
      <el-form-item label="设备"><el-input v-model.trim="query.pileId" placeholder="筛选告警设备" clearable /></el-form-item>
      <el-form-item label="事件状态"><el-select v-model="query.status" clearable placeholder="全部">
        <el-option v-for="(label,key) in labels" :key="key" :value="key" :label="label" />
      </el-select></el-form-item>
      <el-form-item><el-button type="primary" @click="search">查询告警</el-button><el-button @click="load">刷新告警</el-button></el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column label="事件编号" prop="eventId" min-width="180" show-overflow-tooltip />
      <el-table-column label="设备" prop="pileId" min-width="150" show-overflow-tooltip />
      <el-table-column label="类型" prop="faultType" width="110" />
      <el-table-column label="状态" width="115"><template slot-scope="s"><el-tag :type="s.row.status === 'DEAD' ? 'danger' : s.row.status === 'PROCESSED' ? 'success' : 'warning'">{{ labels[s.row.status] }}</el-tag></template></el-table-column>
      <el-table-column label="投递/消费失败" width="120"><template slot-scope="s">{{ s.row.publishAttempts }} / {{ s.row.consumeFailures }}</template></el-table-column>
      <el-table-column label="接收时间" prop="receivedAt" width="170" />
      <el-table-column label="完成时间" prop="processedAt" width="170" />
      <el-table-column label="最近错误" prop="lastError" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="125"><template slot-scope="s">
        <el-button v-if="s.row.ticketId" type="text" @click="$emit('open-ticket', s.row.ticketId)">工单</el-button>
        <el-button v-if="s.row.status === 'DEAD'" v-hasPermi="['operator:fault:alarm-replay']" type="text" :loading="replaying === s.row.id" @click="replay(s.row)">重放</el-button>
      </template></el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" :page.sync="query.pageNum" :limit.sync="query.pageSize" @pagination="load" />
    <el-dialog title="异步告警模拟" :visible.sync="visible" width="540px" append-to-body>
      <el-alert title="用于本地模拟。接收成功不代表工单已生成，请刷新事件状态查看结果。" type="info" :closable="false" />
      <el-form :model="form" label-width="90px" class="alarm-form" :disabled="!!pending">
        <el-form-item label="设备编号"><el-input v-model.trim="form.pileId" placeholder="告警设备编号" maxlength="64" /></el-form-item>
        <el-form-item label="故障类型"><el-select v-model="form.faultType"><el-option v-for="(label,key) in types" :key="key" :value="key" :label="label" /></el-select></el-form-item>
        <el-form-item label="优先级"><el-select v-model="form.priority"><el-option label="普通" value="NORMAL" /><el-option label="高" value="HIGH" /><el-option label="低" value="LOW" /></el-select></el-form-item>
        <el-form-item label="故障描述"><el-input v-model.trim="form.description" type="textarea" maxlength="1000" :rows="3" /></el-form-item>
      </el-form>
      <p v-if="pending" class="muted">重试将复用事件 {{ pending.eventId }}，避免响应丢失后重复提交。</p>
      <span slot="footer"><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">提交告警</el-button></span>
    </el-dialog>
  </el-card>
</template>

<script>
import { listAlarmEvents, acceptAlarmEvent, replayAlarmEvent } from '@/api/operator/fault'

export default {
  name: 'AlarmEvents',
  data() {
    return {
      demoMode: process.env.VUE_APP_DEMO === 'true',
      labels: { PENDING: '待投递', PUBLISHING: '发送中', SENT: '待消费', PROCESSED: '已处理', DEAD: '失败终止' },
      types: { OFFLINE: '设备离线', CONNECTOR: '充电枪故障', POWER: '供电异常', OTHER: '其他故障' },
      query: { pileId: '', status: '', pageNum: 1, pageSize: 10 },
      rows: [], total: 0, loading: false, saving: false, visible: false, replaying: null,
      form: { pileId: '', faultType: 'OFFLINE', priority: 'NORMAL', description: '' }, pending: null
    }
  },
  mounted() { this.load() },
  methods: {
    load() {
      this.loading = true
      return listAlarmEvents(this.query).then(r => { this.rows = r.data.records; this.total = r.data.total }).catch(() => {}).finally(() => { this.loading = false })
    },
    search() { this.query.pageNum = 1; this.load() },
    newAlarm() { this.pending = null; this.form = { pileId: '', faultType: 'OFFLINE', priority: 'NORMAL', description: '' }; this.visible = true },
    submit() {
      if (!this.form.pileId || !this.form.description) return this.$message.warning('请填写设备编号和故障描述')
      if (!this.pending) {
        const bytes = new Uint8Array(16)
        window.crypto.getRandomValues(bytes)
        const suffix = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
        this.pending = { ...this.form, eventId: 'SIM-' + suffix, occurredAt: new Date().toISOString() }
      }
      this.saving = true
      return acceptAlarmEvent(this.pending).then(() => {
        this.$message.success('告警已接收，可刷新查看处理结果')
        this.visible = false; this.pending = null; this.load(); this.$emit('accepted')
      }).catch(() => {}).finally(() => { this.saving = false })
    },
    replay(row) {
      this.$confirm('重放该失败告警？将保留原事件编号并重新尝试处理。', '确认重放').then(() => {
        this.replaying = row.id
        return replayAlarmEvent(row.id).then(() => { this.$message.success('已加入重放队列'); this.load() }).finally(() => { this.replaying = null })
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.alarm-events{margin-top:24px}.alarm-header{display:flex;justify-content:space-between;align-items:center}.alarm-header h3{margin:0 0 8px}.muted{font-size:12px;color:#83909e;word-break:break-all}.alarm-form{margin-top:20px}
</style>
