import request from '@/utils/request'
import { listStation } from '@/api/operator/station'

export function unpackPage(response) {
  const data = response && response.data
  const rows = Array.isArray(data) ? data : data && (data.records || data.rows)
  const records = Array.isArray(rows) ? rows : (response && response.rows) || []
  const total = Number(data && !Array.isArray(data) ? data.total : response.total)
  return { records, total: Number.isFinite(total) ? total : records.length }
}

export async function loadStations() {
  const stations = []
  let total = Infinity
  for (let pageNum = 1; stations.length < total && pageNum <= 100; pageNum++) {
    const page = unpackPage(await listStation({ pageNum, pageSize: 200 }))
    stations.push(...page.records)
    total = page.total
    if (!page.records.length) break
  }
  return { stations, total, truncated: stations.length < total }
}

// Current station forms store longitude in lat and latitude in lng. Some
// imported rows use conventional names: accept only unambiguous mainland ranges.
export function stationPosition(station) {
  if (station.lat == null || station.lng == null || String(station.lat).trim() === '' || String(station.lng).trim() === '') return null
  const first = Number(station.lat); const second = Number(station.lng)
  if (first >= 73 && first <= 136 && second >= 3 && second <= 54) return [first, second]
  if (second >= 73 && second <= 136 && first >= 3 && first <= 54) return [second, first]
  return null
}

export function metric(value, digits = 0) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default {
  data() {
    return { summary: {}, comparison: {}, hourly: [], orderQuality: {}, actionSummary: {}, stations: [], stationTotal: null, faultSummary: {}, alarms: [], pendingFaults: [], offlineDevices: [], trend: [], ranking: [], operatorStats: [], stationStats: [], operators: [], stationOptions: [], canFault: true, scope: { root: Number(this.$store.getters.userId) === 1, tenantId: null, stationId: null }, loading: false, updatedAt: '', failures: [] }
  },
  computed: {
    scopeLabel() {
      const operator = this.operators.find(item => String(item.id) === String(this.scope.tenantId))
      const station = this.stationOptions.find(item => String(item.stationId) === String(this.scope.stationId))
      return [operator ? operator.name : this.scope.root ? '全部运营商' : '本运营商', station ? station.stationName : '全部站点'].join(' / ')
    },
    selectedStation() { return this.scope.stationId ? this.stationOptions.find(item => String(item.stationId) === String(this.scope.stationId)) : null }
  },
  watch: { '$route.query'() { this.refreshOverview() } },
  methods: {
    metric,
    overviewParams() { return { tenantId: this.$route.query.tenantId, stationId: this.$route.query.stationId } },
    async changeScope(value) {
      const station = this.stationOptions.find(item => String(item.stationId) === String(value.stationId))
      if (this.scope.root && value.stationId && !value.tenantId && station) value = { ...value, tenantId: station.tenantId }
      const query = { ...this.$route.query }
      delete query.tenantId; delete query.stationId
      if (value.tenantId) query.tenantId = String(value.tenantId)
      if (value.stationId) query.stationId = String(value.stationId)
      await this.$router.push({ query }).catch(() => {})
    },
    async refreshOverview() {
      const sequence = this.requestSequence = (this.requestSequence || 0) + 1
      this.loading = true
      this.failures = []
      this.summary = {}; this.stations = []; this.stationTotal = null; this.faultSummary = {}; this.alarms = []; this.pendingFaults = []; this.offlineDevices = []; this.trend = []; this.ranking = []; this.operatorStats = []; this.stationStats = []; this.updatedAt = ''
      this.comparison = {}; this.hourly = []; this.orderQuality = {}; this.actionSummary = {}
      try {
        const { data } = await request({ url: '/operator/overview', method: 'get', params: this.overviewParams() })
        if (sequence !== this.requestSequence || this._isDestroyed || this._isBeingDestroyed) return
        this.scope = data.scope
        this.operators = data.operators || []
        this.stationOptions = data.stationOptions || []
        this.summary = data.summary || {}
        this.comparison = data.comparison || {}
        this.hourly = data.hourly || []
        this.orderQuality = data.orderQuality || {}
        this.actionSummary = data.actionSummary || {}
        this.stations = data.stations || []
        this.stationTotal = this.summary.stationTotal
        this.faultSummary = data.faultSummary || {}
        this.alarms = data.alarms || []
        this.pendingFaults = data.pendingFaults || []
        this.offlineDevices = data.offlineDevices || []
        this.trend = data.trend || []
        this.ranking = data.ranking || []
        this.operatorStats = data.operatorStats || []
        this.stationStats = data.stationStats || []
        this.canFault = data.canFault !== false
        this.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      } catch (error) { if (sequence === this.requestSequence) this.failures = ['当前范围数据获取失败，请检查权限或连接后重试'] } finally { if (sequence === this.requestSequence) this.loading = false }
    }
  }
}
