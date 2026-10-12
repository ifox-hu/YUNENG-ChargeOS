<template>
  <div class="app-container fault-page">
    <div class="headline"><div><h2>故障工单</h2><p>从设备告警到问题解决，追踪每一步处理进度</p></div>
      <el-button type="primary" icon="el-icon-bell" v-hasPermi="['operator:fault:add']" @click="alarmVisible=true">模拟设备告警</el-button>
    </div>
    <el-row :gutter="16" class="metrics">
      <el-col :span="6" v-for="item in metrics" :key="item.key"><div class="metric"><span>{{item.label}}</span><strong>{{stats[item.key] || 0}}</strong></div></el-col>
    </el-row>
    <el-row :gutter="16" class="charts">
      <el-col :span="16"><el-card shadow="never"><div slot="header">近七天新增工单</div><div ref="trendChart" class="chart"></div></el-card></el-col>
      <el-col :span="8"><el-card shadow="never"><div slot="header">故障类型分布</div><div ref="typeChart" class="chart"></div></el-card></el-col>
    </el-row>
    <el-form :inline="true" :model="query">
      <el-form-item label="设备编号"><el-input v-model.trim="query.pileId" placeholder="完整桩编号" clearable @keyup.enter.native="search" /></el-form-item>
      <el-form-item label="工单状态"><el-select v-model="query.status" clearable placeholder="全部状态"><el-option v-for="(label,key) in statuses" :key="key" :value="key" :label="label" /></el-select></el-form-item>
      <el-form-item label="故障类型"><el-select v-model="query.faultType" clearable placeholder="全部类型"><el-option v-for="(label,key) in types" :key="key" :value="key" :label="label" /></el-select></el-form-item>
      <el-form-item><el-button type="primary" icon="el-icon-search" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
    </el-form>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="工单编号" prop="ticketNo" min-width="240" show-overflow-tooltip />
      <el-table-column label="设备" min-width="140"><template slot-scope="s">{{s.row.pileName || s.row.pileId}}<div class="muted">{{s.row.pileId}}</div></template></el-table-column>
      <el-table-column label="类型" width="100"><template slot-scope="s">{{types[s.row.faultType]}}</template></el-table-column>
      <el-table-column label="来源" width="100"><template slot-scope="s">{{s.row.source==='USER'?'用户报修':'模拟告警'}}</template></el-table-column>
      <el-table-column label="优先级" width="90"><template slot-scope="s">{{priorities[s.row.priority]}}</template></el-table-column>
      <el-table-column label="状态" width="110"><template slot-scope="s"><el-tag :type="s.row.status==='CLOSED'?'success':'warning'">{{statuses[s.row.status]}}</el-tag></template></el-table-column>
      <el-table-column label="处理人" prop="assigneeName" width="110" />
      <el-table-column label="创建时间" prop="createdAt" width="180" />
      <el-table-column label="操作" width="90"><template slot-scope="s"><el-button type="text" @click="openDetail(s.row.id)">详情</el-button></template></el-table-column>
    </el-table>
    <pagination v-show="total>0" :total="total" :page.sync="query.pageNum" :limit.sync="query.pageSize" @pagination="load" />
    <p class="muted">累计告警 {{stats.alarmCount || 0}} 次 · 平均解决耗时 {{stats.avgResolveMinutes == null ? '暂无' : stats.avgResolveMinutes+' 分钟'}}。统计来自实际工单记录。</p>

    <el-dialog title="模拟设备告警" :visible.sync="alarmVisible" width="500px">
      <el-alert title="用于本地演示，会生成告警记录及工单，不改变设备充电状态。" type="info" :closable="false" />
      <el-form :model="alarm" label-width="90px" class="dialog-form">
        <el-form-item label="设备编号"><el-input v-model.trim="alarm.pileId" maxlength="64" placeholder="例如 202312121" /></el-form-item>
        <el-form-item label="故障类型"><el-select v-model="alarm.faultType"><el-option v-for="(label,key) in types" :key="key" :value="key" :label="label" /></el-select></el-form-item>
        <el-form-item label="优先级"><el-select v-model="alarm.priority"><el-option v-for="(label,key) in priorities" :key="key" :value="key" :label="label" /></el-select></el-form-item>
        <el-form-item label="故障描述"><el-input type="textarea" v-model.trim="alarm.description" maxlength="1000" show-word-limit :rows="3" /></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="alarmVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="createAlarm">生成告警</el-button></span>
    </el-dialog>
    <el-dialog title="工单详情与处理记录" :visible.sync="detailVisible" width="800px">
      <div v-if="detail.ticket" v-loading="detailLoading">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单">{{detail.ticket.ticketNo}}</el-descriptions-item>
          <el-descriptions-item label="状态">{{statuses[detail.ticket.status]}}</el-descriptions-item>
          <el-descriptions-item label="设备">{{detail.ticket.pileId}}</el-descriptions-item>
          <el-descriptions-item label="故障">{{types[detail.ticket.faultType]}}</el-descriptions-item>
          <el-descriptions-item label="处理人">{{detail.ticket.assigneeName || '尚未分配'}}</el-descriptions-item>
          <el-descriptions-item label="描述">{{detail.ticket.description}}</el-descriptions-item>
        </el-descriptions>
        <div class="actions">
          <el-button v-if="['NEW','ASSIGNED'].includes(detail.ticket.status)" v-hasPermi="['operator:fault:assign']" @click="prepareAction('ASSIGN')">分配处理人</el-button>
          <el-button v-if="detail.ticket.status==='ASSIGNED'" v-hasPermi="['operator:fault:handle']" type="primary" @click="prepareAction('START')">开始处理</el-button>
          <el-button v-if="detail.ticket.status==='PROCESSING'" v-hasPermi="['operator:fault:handle']" type="primary" @click="prepareAction('RESOLVE')">提交解决结果</el-button>
          <el-button v-if="detail.ticket.status==='RESOLVED'" v-hasPermi="['operator:fault:close']" type="success" @click="prepareAction('CONFIRM')">确认关闭</el-button>
        </div>
        <h4>处理时间线</h4>
        <el-timeline><el-timeline-item v-for="log in detail.logs" :key="log.id" :timestamp="log.createdAt">
          <strong>{{statuses[log.toStatus]}} · {{log.actorName}}</strong><p>{{log.note}}</p>
        </el-timeline-item></el-timeline>
        <h4 v-if="detail.reports && detail.reports.length">用户报修记录</h4>
        <p v-for="(report,index) in detail.reports" :key="index">{{report.createdAt}} · {{report.description}}</p>
      </div>
    </el-dialog>
    <el-dialog :title="actionLabels[action.action]" :visible.sync="actionVisible" width="480px" append-to-body>
      <el-form label-width="80px">
        <el-form-item v-if="action.action==='ASSIGN'" label="处理人"><el-select v-model="action.assigneeId" filterable placeholder="选择同租户处理人"><el-option v-for="u in assignees" :key="u.userId" :value="u.userId" :label="u.nickName+' ('+u.userName+')'" /></el-select></el-form-item>
        <el-form-item label="处理说明"><el-input v-model.trim="action.note" type="textarea" maxlength="1000" :rows="4" placeholder="填写处理步骤或解决结果" /></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="actionVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitAction">确认</el-button></span>
    </el-dialog>
  </div>
</template>
<script>
import * as api from '@/api/operator/fault'
import * as echarts from 'echarts'
export default {
  name: 'FaultWorkOrders',
  data() { return {
    statuses: {NEW:'待分配',ASSIGNED:'已分配',PROCESSING:'处理中',RESOLVED:'待确认',CLOSED:'已关闭'},
    types: {OFFLINE:'设备离线',CONNECTOR:'充电枪故障',POWER:'供电异常',OTHER:'其他故障'},
    priorities: {LOW:'低',NORMAL:'普通',HIGH:'高'},
    actionLabels: {ASSIGN:'分配工单',START:'开始处理',RESOLVE:'提交解决结果',CONFIRM:'确认关闭'},
    metrics: [{key:'total',label:'累计工单'},{key:'active',label:'活动工单'},{key:'pending',label:'待分配'},{key:'closed',label:'已关闭'}],
    query:{pageNum:1,pageSize:10,pileId:'',status:'',faultType:''},rows:[],total:0,stats:{},
    loading:false,saving:false,detailLoading:false,alarmVisible:false,detailVisible:false,actionVisible:false,
    alarm:{pileId:'',faultType:'OFFLINE',priority:'NORMAL',description:''},detail:{},assignees:[],
    action:{action:'ASSIGN',note:'',assigneeId:null}
  }},
  mounted() { this.refresh(); window.addEventListener('resize',this.resize) },
  beforeDestroy() { window.removeEventListener('resize',this.resize); if(this.trendChart)this.trendChart.dispose();if(this.typeChart)this.typeChart.dispose() },
  methods:{
    load() { this.loading=true; return api.listFaults(this.query).then(r=>{this.rows=r.data.records;this.total=r.data.total}).finally(()=>{this.loading=false}) },
    refresh() { this.load(); api.faultStats().then(r=>{this.stats=r.data;this.$nextTick(this.drawCharts)}) },
    search() {this.query.pageNum=1;this.load()},
    reset() {this.query={pageNum:1,pageSize:10,pileId:'',status:'',faultType:''};this.load()},
    resize() {if(this.trendChart)this.trendChart.resize();if(this.typeChart)this.typeChart.resize()},
    drawCharts() {
      if(!this.trendChart)this.trendChart=echarts.init(this.$refs.trendChart);
      if(!this.typeChart)this.typeChart=echarts.init(this.$refs.typeChart);
      const dates=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))}
      const counts={};(this.stats.trend||[]).forEach(x=>{counts[x.day]=x.count});
      this.trendChart.setOption({color:['#008773'],tooltip:{trigger:'axis'},grid:{left:35,right:20,top:20,bottom:25},xAxis:{type:'category',data:dates.map(d=>d.slice(5))},yAxis:{type:'value',minInterval:1},series:[{type:'bar',data:dates.map(d=>counts[d]||0),barMaxWidth:32}]});
      this.typeChart.setOption({color:['#008773','#4f8ff7','#edaa45','#9ba7b8'],tooltip:{trigger:'item'},series:[{type:'pie',radius:['40%','65%'],data:(this.stats.byType||[]).map(x=>({name:this.types[x.faultType],value:x.count}))}]});
    },
    openDetail(id) {this.detailLoading=true;return api.getFault(id).then(r=>{this.detail=r.data;this.detailVisible=true}).finally(()=>{this.detailLoading=false})},
    createAlarm() {
      if(!this.alarm.pileId||!this.alarm.description)return this.$message.warning('请填写设备编号和故障描述');
      this.saving=true;api.simulateAlarm(this.alarm).then(r=>{this.$message.success(r.data.merged?'告警已合并到活动工单':'已生成工单');this.alarmVisible=false;this.refresh();this.openDetail(r.data.ticket.id)}).finally(()=>{this.saving=false})
    },
    prepareAction(kind) {
      this.action={action:kind,note:'',assigneeId:this.detail.ticket.assigneeId};
      if(kind==='ASSIGN'){api.getAssignees(this.detail.ticket.id).then(r=>{this.assignees=r.data;this.actionVisible=true})}
      else this.actionVisible=true
    },
    submitAction() {
      if(!this.action.note || (this.action.action==='ASSIGN'&&!this.action.assigneeId))return this.$message.warning('请填写处理人及处理说明');
      this.saving=true;api.actOnFault(this.detail.ticket.id,this.action).then(r=>{this.detail=r.data;this.actionVisible=false;this.$message.success('工单已更新');this.refresh()}).finally(()=>{this.saving=false})
    }
  }
}
</script>
<style scoped>
.headline{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.headline h2{margin:0 0 10px}.headline p,.muted{color:#83909e;font-size:13px}
.metric{background:#fff;border:1px solid #e5ecea;border-radius:8px;padding:20px;margin-bottom:20px}.metric span{display:block;color:#73867f}.metric strong{display:block;font-size:30px;margin-top:12px;color:#087d69}
.charts{margin-bottom:22px}.chart{height:200px}.dialog-form{margin-top:20px}.actions{margin:20px 0}.fault-page{background:#f7faf9}
.fault-page ::v-deep .el-descriptions-item__label{width:90px;white-space:nowrap}
.fault-page ::v-deep .el-descriptions-item__content{word-break:break-all}
</style>

