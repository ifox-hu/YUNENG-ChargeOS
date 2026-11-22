<template>
  <el-dialog
    title="站点设备"
    :visible="true"
    width="min(960px, 94vw)"
    append-to-body
    @close="$emit('close')"
  >
    <div v-loading="loading" class="station-devices">
      <el-alert v-if="failed" title="无法读取该站点的设备" type="warning" :closable="false" />
      <template v-else-if="station">
        <header class="device-heading">
          <h3>{{ station.stationName }}</h3>
          <p>{{ station.address }}</p>
        </header>
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
                @click="selectedId = pile.pileId"
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
                :to="{ path: '/operate/fault', query: {
                  tenantId: String(station.tenantId), stationId: String(station.stationId),
                  pileId: String(selected.pileId), view: 'alarms'
                }}"
              >查看告警 <i class="el-icon-arrow-right" /></router-link>
            </div>
            <p class="pile-id">{{ selected.pileId }}</p>
            <el-table :data="selected.ports" empty-text="该充电桩暂无枪口" size="small">
              <el-table-column label="枪口" min-width="70">
                <template slot-scope="{ row }">{{ row.name || row.deviceId || row.portId }}</template>
              </el-table-column>
              <el-table-column label="状态" min-width="90">
                <template slot-scope="{ row }">{{ portStatus(row, selected).label }}</template>
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
import { getDemoStationDevices } from '@/api/operator/station'

const pileStates = {
  0: { label: '在线', type: 'success' },
  1: { label: '离线', type: 'danger' }
}
const unknown = { label: '未知', type: 'info' }
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
    return { station: null, piles: [], selectedId: null, loading: true, failed: false }
  },
  computed: {
    selected() { return this.piles.find(pile => pile.pileId === this.selectedId) },
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
  async created() {
    try {
      const { data } = await getDemoStationDevices(this.stationId, this.tenantId)
      this.station = data.station
      this.piles = data.piles
      const selected = this.piles.find(pile => String(pile.pileId) === this.pileId) || this.piles[0]
      this.selectedId = selected?.pileId
    } catch (_) {
      this.failed = true
    } finally {
      this.loading = false
    }
  },
  methods: {
    pileStatus(pile) { return pileStates[pile.runningStatus] || unknown },
    portStatus(port, pile) {
      if (String(pile.runningStatus) === '1' || String(port.runningStatus) === '1') return pileStates[1]
      if (String(port.runningStatus) !== '2') return unknown
      return port.gunStatus == null ? unknown : portStates[Number(port.gunStatus)] || unknown
    }
  }
}
</script>

<style scoped>
.station-devices { min-height: 110px; color: #26364d; }
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
@media (max-width: 680px) {
  .device-layout { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .pile-list { max-height: 180px; }
}
</style>
