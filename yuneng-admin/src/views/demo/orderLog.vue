<template><div class="app-container"><el-alert title="模拟操作日志：记录当前浏览器中的工单处理操作，不连接后端。" type="info" :closable="false"/><el-button style="margin:18px 0" @click="load">刷新记录</el-button><el-table :data="rows"><el-table-column label="工单" prop="ticketNo"/><el-table-column label="操作人" prop="actorName"/><el-table-column label="处理说明" prop="note"/><el-table-column label="操作时间" prop="createdAt"/></el-table></div></template>
<script>
import request from '@/utils/request'
export default {name:'DemoOperationLogs',data(){return {rows:[]}},created(){this.load()},methods:{load(){request({url:'/demo/operation-logs',method:'get'}).then(r=>{this.rows=r.data})}}}
</script>
