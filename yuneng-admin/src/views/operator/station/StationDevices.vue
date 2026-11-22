<template>
  <el-dialog
    title="站点设备"
    :visible="true"
    width="min(960px, 94vw)"
    append-to-body
    @close="$emit('close')"
  >
    <div v-loading="loading" class="station-devices">
      <el-alert v-if="failed" title="无法刷新该站点的设备" type="warning" :closable="false">
        <el-button type="text" @click="loadDevices()">重试</el-button>
      </el-alert>
      <template v-if="station">
        <header class="device-heading">
          <div>
            <h3>{{ station.stationName }}</h3>
            <p>{{ station.stationCode }} <span v-if="station.address">· {{ station.address }}</span></p>
          </div>
          <div class="device-actions">
            <el-button size="small" icon="el-icon-refresh" @click="loadDevices()">刷新</el-button>
            <el-button v-if="canAdd && !form" size="small" type="primary" icon="el-icon-plus" @click="openForm">添加充电桩</el-button>
          </div>
        </header>
        <section v-if="form" v-loading="loadingRates" class="device-form" aria-label="添加充电桩">
          <h4>添加充电桩</h4>
          <el-alert v-if="noRates" title="请先在计费规则中配置本运营商的汽车充电费率。" type="warning" :closable="false" />
          <el-form ref="deviceForm" :model="form" :rules="rules" label-width="112px" size="small" @submit.native.prevent="saveDevice">
            <div class="device-fields">
              <el-form-item label="桩编号" prop="pileId">
                <el-input v-model.trim="form.pileId" maxlength="64" placeholder="模拟桩以 SIM- 开头" />
              </el-form-item>
              <el-form-item label="桩名称" prop="name"><el-input v-model.trim="form.name" maxlength="64" /></el-form-item>
              <el-form-item label="充电类型" prop="pileType">
                <el-select v-model="form.pileType"><el-option label="慢充" :value="0" /><el-option label="快充" :value="1" /></el-select>
              </el-form-item>
              <el-form-item label="枪口数量" prop="gunCount">
                <el-input-number v-model="form.gunCount" :min="1" :max="8" :precision="0" />
              </el-form-item>
              <el-form-item label="额定电压（V）" prop="voltage"><el-input v-model.trim="form.voltage" inputmode="decimal" /></el-form-item>
              <el-form-item label="额定电流（A）" prop="electricity"><el-input v-model.trim="form.electricity" inputmode="decimal" /></el-form-item>
              <el-form-item label="最大功率（kW）" prop="maxPower">
                <el-input-number v-model="form.maxPower" :min="1" :max="2147483647" :precision="0" />
              </el-form-item>
              <el-form-item label="充电费率" prop="wxRuleId">
                <el-select v-model="form.wxRuleId" filterable placeholder="选择本运营商费率">
                  <el-option v-for="rate in rates" :key="rate.id" :label="rate.changeName || String(rate.id)" :value="rate.id" />
                </el-select>
              </el-form-item>
            </div>
            <div class="device-actions">
              <el-button :disabled="saving" @click="form = null">取消</el-button>
              <el-button type="primary" native-type="submit" :loading="saving" :disabled="!rates.length">保存充电桩和枪口</el-button>
            </div>
          </el-form>
        </section>
        <div class="device-summary">
          <span>{{ piles.length }} 台充电桩</span>
          <span>{{ online }} 台在线</span>
          <span>{{ offline }} 台离线</span>
          <span>{{ portCounts.total }} 个枪口</span>
          <span>{{ portCounts.idle }} 个空闲</span>
          <span>{{ portCounts.fault }} 个故障</span>
        </div>
        <div class="device-layout">
          <section aria-label="充电桩列表">
            <h4>充电桩</h4>
            <p v-if="!piles.length" class="device-empty">该站点暂无充电桩</p>
            <div v-else class="pile-list">
              <button
                v-for="pile in piles"
                :key="pile.pileId"
                type="button"
                :aria-pressed="selected === pile"
                @click="selectedId = String(pile.pileId)"
              >
                <span>{{ pile.name || pile.pileId }}</span>
                <el-tag size="mini" :type="pileStatus(pile).type">{{ pileStatus(pile).label }}</el-tag>
              </button>
            </div>
          </section>
          <section v-if="selected" aria-label="枪口状态">
            <div class="port-heading">
              <h4>枪口状态</h4>
              <router-link
                v-if="canViewAlarms"
                :to="{ path: '/operate/fault', query: {
                  tenantId: String(station.tenantId), stationId: String(station.stationId),
                  pileId: String(selected.pileId), view: 'alarms'
                }}"
              >查看告警 <i class="el-icon-arrow-right" /></router-link>
            </div>
            <p class="pile-id">{{ selected.pileId }}</p>
            <dl class="device-data">
              <div><dt>充电费率</dt><dd>{{ selected.rateName || (selected.wxRuleId ? '规则 ' + selected.wxRuleId : '未绑定') }}</dd></div>
              <div><dt>最近心跳</dt><dd>{{ heartbeatLabel }}</dd></div>
            </dl>
            <el-button v-if="canSimulate" size="small" :loading="simulating" @click="toggleSimulation">
              {{ selected.runningStatus === 0 ? '停止模拟' : '启动模拟' }}
            </el-button>
            <el-table :data="selected.ports" empty-text="该充电桩暂无枪口" size="small">
              <el-table-column label="枪口" min-width="70">
                <template slot-scope="{ row }">{{ row.name || row.deviceId || row.portId }}</template>
              </el-table-column>
              <el-table-column label="状态" min-width="90">
                <template slot-scope="{ row }">{{ portStatus(row, selected).label }}</template>
              </el-table-column>
              <el-table-column label="插枪" min-width="75">
                <template slot-scope="{ row }">{{ plugState(row.gunInsert) }}</template>
              </el-table-column>
              <el-table-column label="故障原因" min-width="130">
                <template slot-scope="{ row }">{{ row.faultReason || '—' }}</template>
              </el-table-column>
            </el-table>
          </section>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<script>
import { getStationDevices, getStationDeviceRates, addStationDevice, setStationDeviceSimulation } from '@/api/operator/station'

const pileStates = {
  0: { label: '在线', type: 'success' },
  1: { label: '离线', type: 'danger' }
}
const unknown = { label: '未知', type: 'info' }
const required = { required: true, message: '请填写此项', trigger: ['blur', 'change'] }
const positive = { pattern: /^(?!0+(?:\.0+)?$)[0-9]{1,7}(\.[0-9]{1,3})?$/, message: '请输入有效的正数', trigger: 'blur' }
const rules = {
  pileId: [required, { pattern: /^[A-Za-z0-9_-]{1,64}$/, message: '使用字母、数字、下划线或连字符', trigger: 'blur' }],
  name: [required], pileType: [required], voltage: [required, positive], electricity: [required, positive],
  maxPower: [required], gunCount: [required], wxRuleId: [required]
}
const portStates = {
  0: { label: '空闲', key: 'idle' },
  1: { label: '充电中' },
  2: { label: '预约' },
  3: { label: '启动中' },
  5: { label: '故障', key: 'fault' },
  10: { label: '启动失败', key: 'fault' }
}

export default {
  name: 'StationDevices',
  props: { stationId: { type: String, required: true }, tenantId: String, pileId: String },
  data() {
    return {
      station: null, piles: [], selectedId: this.pileId, loading: false, failed: false,
      canManage: false, form: null, rates: [], loadingRates: false, noRates: false,
      saving: false, simulating: false, rules
    }
  },
  computed: {
    selected() { return this.piles.find(pile => String(pile.pileId) === this.selectedId) },
    canAdd() { return this.canManage && ['operator:pile:add', 'operator:port:add', 'operator:rule:list'].every(this.hasPermission) },
    canViewAlarms() { return this.hasPermission('operator:fault:list') },
    canSimulate() { return this.canAdd && this.selected && /^SIM-[A-Za-z0-9_-]{1,60}$/.test(this.selected.pileId) },
    heartbeatLabel() { return this.selected?.lastHeartbeat || '暂无记录' },
    online() { return this.piles.filter(pile => String(pile.runningStatus) === '0').length },
    offline() { return this.piles.filter(pile => String(pile.runningStatus) === '1').length },
    portCounts() {
      const counts = { total: 0, idle: 0, fault: 0 }
      this.piles.forEach(pile => pile.ports.forEach(port => {
        const status = this.portStatus(port, pile)
        counts.total += 1
        if (status.key) counts[status.key] += 1
      }))
      return counts
    }
  },
  created() {
    this.loadDevices()
    this.refreshTimer = setInterval(() => {
      if (!document.hidden && !this.form && !this.simulating && !this.failed) this.loadDevices(true)
    }, 15000)
  },
  beforeDestroy() {
    clearInterval(this.refreshTimer)
  },
  methods: {
    hasPermission(permission) {
      return this.$store.getters.permissions.some(value => value === '*:*:*' || value === permission)
    },
    async loadDevices(quiet = false) {
      if (quiet && this.deviceRequest) return
      this.loading = !quiet
      const request = getStationDevices(this.stationId, this.tenantId)
      this.deviceRequest = request
      try {
        const { data } = await request
        if (this.deviceRequest !== request) return
        this.station = data.station
        this.piles = data.piles
        this.canManage = data.canManage === true
        if (!this.selected) this.selectedId = this.piles.length ? String(this.piles[0].pileId) : null
        this.failed = false
      } catch (_) {
        if (this.deviceRequest === request) this.failed = true
      } finally {
        if (this.deviceRequest === request) {
          this.deviceRequest = null
          this.loading = false
        }
      }
    },
    async openForm() {
      this.form = { pileId: '', name: '', pileType: 1, gunCount: 2, voltage: '', electricity: '', maxPower: undefined, wxRuleId: null }
      this.rates = []
      this.noRates = false
      this.loadingRates = true
      try {
        const { data } = await getStationDeviceRates(this.stationId)
        this.rates = data
        this.noRates = !data.length
      } catch (_) {
        this.form = null
      } finally {
        this.loadingRates = false
      }
    },
    async saveDevice() {
      if (this.saving || !this.rates.length) return
      this.saving = true
      try {
        if (!await this.$refs.deviceForm.validate().catch(() => false)) return
        const { data } = await addStationDevice(this.stationId, this.form)
        this.selectedId = data.pileId
        this.form = null
        this.$message.success('充电桩和枪口已创建')
        await this.loadDevices()
      } catch (_) {
        // The shared request handler displays the server error.
      } finally {
        this.saving = false
      }
    },
    async toggleSimulation() {
      const online = this.selected.runningStatus !== 0
      this.simulating = true
      try {
        await setStationDeviceSimulation(this.selected.pileId, online)
        this.$message.success(online ? '模拟桩已启动' : '模拟桩已停止')
        await this.loadDevices()
      } catch (_) {
        // The shared request handler displays the server error.
      } finally {
        this.simulating = false
      }
    },
    pileStatus(pile) { return pileStates[pile.runningStatus] || unknown },
    plugState(value) {
      if (['Y', '1'].includes(String(value))) return '已插枪'
      if (['N', '0'].includes(String(value))) return '未插枪'
      return '未知'
    },
    portStatus(port, pile) {
      if (String(pile.runningStatus) === '1' || String(port.runningStatus) === '1') return pileStates[1]
      if (String(pile.runningStatus) !== '0' && String(port.runningStatus) !== '2') return unknown
      if (port.state === 'F') return portStates[5]
      if (String(port.canUse) === '1') return { label: '不可用' }
      return portStates[port.gunStatus] || ({ N: portStates[0], Y: portStates[1] }[port.state]) || unknown
    }
  }
}
</script>

<style scoped>
.station-devices { min-height: 110px; color: #26364d; }
.device-heading, .device-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.device-actions { justify-content: flex-end; }
.device-actions .el-button + .el-button { margin-left: 0; }
.device-heading h3 { margin: 0 0 6px; font-size: 18px; }
.device-heading p, .pile-id, .device-empty { color: #62748b; overflow-wrap: anywhere; }
.device-summary { display: flex; flex-wrap: wrap; gap: 10px 20px; padding: 14px 0; margin-bottom: 12px; border-bottom: 1px solid #e3eaf3; }
.device-layout { display: grid; grid-template-columns: minmax(225px, 1fr) minmax(0, 1.4fr); gap: 24px; }
.device-layout h4 { margin: 0 0 10px; }
.pile-list { max-height: 330px; overflow: auto; }
.pile-list button { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 9px 10px; background: white; border: 0; border-bottom: 1px solid #e3eaf3; color: inherit; text-align: left; cursor: pointer; }
.pile-list button[aria-pressed="true"] { background: #edf5ff; color: #245eb2; }
.pile-list button:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
.port-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.port-heading a { color: #2563eb; }
.pile-id { margin-top: 0; }
.device-form { margin: 12px 0; padding: 16px; border: 1px solid #e3eaf3; border-radius: 6px; }
.device-form h4 { margin: 0 0 14px; }
.device-form .el-alert { margin-bottom: 14px; }
.device-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
.device-fields .el-select, .device-fields .el-input-number { width: 100%; }
.device-data { display: flex; flex-wrap: wrap; gap: 12px 22px; margin: 0 0 12px; }
.device-data dt { color: #62748b; font-size: 12px; }
.device-data dd { margin: 4px 0 0; }
@media (max-width: 680px) {
  .device-layout, .device-fields { grid-template-columns: minmax(0, 1fr); }
  .device-layout { gap: 18px; }
  .pile-list { max-height: 180px; }
}
</style>
