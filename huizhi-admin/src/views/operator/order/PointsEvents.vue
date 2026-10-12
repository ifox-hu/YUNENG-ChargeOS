<template>
  <div v-if="!demoMode && Number($store.state.user.id) === 1" class="points-events">
    <el-button size="small" icon="el-icon-refresh" @click="open">积分发放监控</el-button>
    <el-dialog title="积分事件与补偿" :visible.sync="visible" width="90%" append-to-body>
      <div class="toolbar">
        <el-select v-model="status" clearable placeholder="全部状态" size="small" @change="page=1; load()">
          <el-option v-for="(label, key) in labels" :key="key" :label="label" :value="key" />
        </el-select>
        <el-button size="small" :loading="loading" @click="load">刷新</el-button>
        <span v-for="item in counts" :key="item.status">{{ labels[item.status] }}：{{ item.total }}</span>
      </div>
      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="order_id" label="订单" min-width="150" show-overflow-tooltip />
        <el-table-column prop="member_id" label="会员" width="85" />
        <el-table-column label="状态" width="110"><template slot-scope="scope">
          <el-tag :type="scope.row.status==='DEAD'?'danger':scope.row.status==='CONSUMED'?'success':'info'">{{ labels[scope.row.status] }}</el-tag>
        </template></el-table-column>
        <el-table-column prop="publish_attempts" label="投递次数" width="85" />
        <el-table-column prop="consume_failures" label="消费失败" width="85" />
        <el-table-column prop="next_retry_at" label="下次检查" min-width="155" />
        <el-table-column prop="last_error" label="最近错误" min-width="200" show-overflow-tooltip />
        <el-table-column prop="consumed_at" label="到账时间" min-width="155" />
        <el-table-column label="操作" width="90"><template slot-scope="scope">
          <el-button v-if="scope.row.status==='DEAD'" size="mini" type="text" :disabled="retrying" @click="retry(scope.row)">重新投递</el-button>
        </template></el-table-column>
      </el-table>
      <div class="toolbar">
        <el-button size="small" :disabled="page<=1||loading" @click="page--; load()">上一页</el-button>
        <span>第 {{ page }} 页</span>
        <el-button size="small" :disabled="rows.length<20||loading" @click="page++; load()">下一页</el-button>
        <span>消息已发送与积分已到账分开记录；失败终止事件需修复原因后重新投递。</span>
      </div>
    </el-dialog>
  </div>
</template>
<script>
import request from '@/utils/request'
export default {
  name: 'PointsEvents',
  data() {
    return { demoMode: process.env.VUE_APP_DEMO === 'true', visible: false, loading: false, retrying: false, rows: [], counts: [], page: 1, status: '',
      labels: { PENDING: '待投递', PUBLISHING: '投递中', SENT: '等待到账', RETRY: '待重试', CONSUMED: '已到账', DEAD: '失败终止' } }
  },
  methods: {
    open() { this.visible = true; this.page = 1; this.load() },
    async load() {
      this.loading = true
      try {
        const result = await request({ url: '/operator/points/events', params: { page: this.page, size: 20, status: this.status || undefined } })
        this.rows = result.data || []; this.counts = result.counts || []
      } finally { this.loading = false }
    },
    async retry(row) {
      try { await this.$confirm('修复失败原因后，重新投递此积分事件？', '确认补偿') } catch (_) { return }
      this.retrying = true
      try {
        await request({ url: '/operator/points/events/' + encodeURIComponent(row.event_id) + '/retry', method: 'post' })
        this.$message.success('已加入补偿队列'); await this.load()
      } finally { this.retrying = false }
    }
  }
}
</script>
<style scoped>
.points-events { margin-bottom: 16px; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 16px 0; color: #606266; font-size: 13px; }
</style>
