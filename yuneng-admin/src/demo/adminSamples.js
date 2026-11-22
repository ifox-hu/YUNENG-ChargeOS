const dateAt = minutes => new Date(Date.now() - minutes * 60000).toLocaleString('sv-SE')

const dictionary = {
  sys_normal_disable: ['0:正常', '1:停用'],
  sys_common_status: ['0:成功', '1:失败'],
  sys_show_hide: ['0:显示', '1:隐藏'],
  sys_yes_no: ['Y:是', 'N:否', '0:否', '1:是'],
  sys_user_sex: ['0:男', '1:女', '2:未知'],
  sys_notice_type: ['1:通知', '2:公告'],
  sys_notice_status: ['0:正常', '1:关闭'],
  sys_message_type: ['0:系统通知', '1:运维告警'],
  sys_oper_type: ['1:新增', '2:修改', '3:删除', '5:导出'],
  sys_job_address_type: ['0:自动注册', '1:手动录入'],
  sys_job_trigger_status: ['0:停止', '1:运行'],
  sys_job_trigger_code: ['0:待执行', '200:成功', '500:失败'],
  sys_job_log_status: ['-1:全部', '1:成功', '2:失败', '3:运行中'],
  sys_job_schedule_type: ['CRON:Cron', 'FIX_RATE:固定间隔'],
  sys_job_glue_type: ['BEAN:BEAN'],
  sys_job_executor_route_strategy: ['FIRST:第一个', 'ROUND:轮询'],
  sys_job_misfire_strategy: ['DO_NOTHING:忽略', 'FIRE_ONCE_NOW:立即执行一次'],
  sys_job_executor_block_strategy: ['SERIAL_EXECUTION:单机串行', 'DISCARD_LATER:丢弃后续调度'],
  sys_job_log_clear_type: ['1:一个月之前', '2:三个月之前'],
  oss_type: ['MinIO:MinIO', 'S3:S3 兼容存储'],
  pile_type: ['AC:交流桩', 'DC:直流桩']
}

const dictRows = Object.entries(dictionary).flatMap(([dictType, entries], typeIndex) =>
  entries.map((entry, index) => {
    const [dictValue, dictLabel] = entry.split(':')
    return { dictCode: 1000 + typeIndex * 10 + index, dictType, dictValue, dictLabel, dictSort: index + 1, status: '0', listClass: '' }
  })
)

const executors = [
  { id: 1, appname: 'charge-ops-demo', title: '充电运营执行器', addressType: 0, addressList: 'http://192.0.2.21:9999' },
  { id: 2, appname: 'charge-report-demo', title: '经营统计执行器', addressType: 1, addressList: 'http://192.0.2.22:9999' }
]
const tasks = [
  { id: 101, jobGroup: 1, jobDesc: '检查充电桩心跳', executorHandler: 'checkPileHeartbeat', scheduleConf: '0 */5 * * * ?', triggerStatus: 1, author: '设备运维组' },
  { id: 102, jobGroup: 1, jobDesc: '补发待处理积分', executorHandler: 'repairPendingPoints', scheduleConf: '0 */10 * * * ?', triggerStatus: 1, author: '运营支持组' },
  { id: 103, jobGroup: 2, jobDesc: '汇总站点经营日报', executorHandler: 'summarizeStationDaily', scheduleConf: '0 15 0 * * ?', triggerStatus: 0, author: '经营分析组' }
].map(task => ({ scheduleType: 'CRON', glueType: 'BEAN', executorRouteStrategy: 'FIRST', misfireStrategy: 'DO_NOTHING',
  executorBlockStrategy: 'SERIAL_EXECUTION', executorTimeout: 30, executorFailRetryCount: 1, ...task }))
const taskLogs = tasks.map((task, i) => ({
  id: 201 + i, jobId: task.id, jobGroup: task.jobGroup, triggerCode: 200,
  executorAddress: executors.find(group => group.id === task.jobGroup).addressList,
  triggerTime: dateAt(10 + i * 20), handleTime: dateAt(9 + i * 20),
  triggerMsg: task.jobDesc, handleCode: i === 1 ? 500 : 200, logStatus: i === 1 ? 2 : 1,
  handleMsg: ['已检查 15 台演示设备', '模拟消息发布超时，等待下次补偿', '已生成 3 个演示站点的日报'][i]
}))

function exampleLists() {
  const createTime = dateAt(1440)
  const departments = [
    { deptId: 100, parentId: 0, deptName: '平台运营部', leader: '运营主管' },
    { deptId: 101, parentId: 100, deptName: '运营支持组', leader: '运营专员' },
    { deptId: 102, parentId: 100, deptName: '设备运维组', leader: '值班工程师' },
    { deptId: 103, parentId: 100, deptName: '经营分析组', leader: '报表专员' }
  ].map((dept, index) => ({ ...dept, orderNum: index + 1, status: '0', createTime }))
  const codeTables = [
    ['c_charging_station', '充电站点档案', 'ChargingStation'],
    ['c_charging_order', '充电订单与结算记录', 'ChargingOrder'],
    ['c_operator_charge_rule', '运营商启充规则', 'OperatorChargeRule']
  ].map(([tableName, tableComment, className], index) => ({ tableId: index + 1, tableName, tableComment, className, createTime, updateTime: dateAt(60 + index) }))
  return {
    '/system/dept/list': departments,
    '/system/user/list': [
      { userId: 8101, userName: 'ops_demo', nickName: '运营专员', deptId: 101, phonenumber: '13800008101' },
      { userId: 8102, userName: 'maintenance_demo', nickName: '值班工程师', deptId: 102, phonenumber: '13800008102' }
    ].map(user => ({ ...user, dept: departments.find(dept => dept.deptId === user.deptId), status: '0', createTime })),
    '/system/role/list': [
      { roleId: 8101, roleName: '运营专员', roleKey: 'demo_ops', roleSort: 2, status: '0', createTime },
      { roleId: 8102, roleName: '设备运维', roleKey: 'demo_maintenance', roleSort: 3, status: '0', createTime }
    ],
    '/system/post/list': [
      { postId: 8101, postName: '站点运营专员', postCode: 'demo_station_ops', postSort: 2, status: '0', createTime },
      { postId: 8102, postName: '设备巡检工程师', postCode: 'demo_maintenance', postSort: 3, status: '0', createTime }
    ],
    '/system/tenantpackage/list': [
      { id: 1, name: '基础运营套餐', status: '0', createTime },
      { id: 2, name: '站点运维套餐', status: '0', createTime }
    ],
    '/system/dict/type/list': Object.keys(dictionary).map((dictType, i) => ({
      dictId: 8100 + i, dictName: ({ sys_normal_disable: '启停状态', sys_job_trigger_code: '调度结果', pile_type: '充电桩类型' })[dictType] || dictType,
      dictType, status: '0', createTime
    })),
    '/system/dict/data/list': dictRows,
    '/system/notice/list': [
      { noticeId: 8101, noticeTitle: '北区充电站设备例行巡检', noticeType: '1', noticeContent: '演示巡检窗口为周三 10:00—11:00，请留意设备状态。', status: '0', createBy: 'ops_demo', createTime },
      { noticeId: 8102, noticeTitle: '经营日报导出说明', noticeType: '2', noticeContent: '可按站点筛选后导出日报。', status: '0', createBy: 'admin', createTime }
    ],
    '/system/config/list': [
      { configId: 8101, configName: '站点离线判定间隔（分钟）', configKey: 'demo.pile.offlineMinutes', configValue: '5', configType: 'N', createTime },
      { configId: 8102, configName: '经营日报保留天数', configKey: 'demo.report.retentionDays', configValue: '30', configType: 'N', createTime }
    ],
    '/system/online/list': [
      { tokenId: 'sample-ops-session', userName: 'ops_demo', ipaddr: '192.0.2.31', loginLocation: '演示运营中心', browser: 'Chrome', os: 'Windows', loginTime: dateAt(12) },
      { tokenId: 'sample-maintenance-session', userName: 'maintenance_demo', ipaddr: '192.0.2.32', loginLocation: '演示设备运维组', browser: 'Edge', os: 'Windows', loginTime: dateAt(24) }
    ],
    '/system/logininfor/list': [
      { infoId: 1, userName: 'ops_demo', ipaddr: '192.0.2.31', status: '0', msg: '登录成功', accessTime: dateAt(12) },
      { infoId: 2, userName: 'maintenance_demo', ipaddr: '192.0.2.32', status: '0', msg: '登录成功', accessTime: dateAt(24) },
      { infoId: 3, userName: 'ops_demo', ipaddr: '192.0.2.31', status: '1', msg: '验证码已过期', accessTime: dateAt(14) }
    ],
    '/system/operlog/list': [
      { operId: 1, title: '充电规则', businessType: 2, requestMethod: 'PUT', operName: 'ops_demo', operUrl: '/operator/chargeRule', status: 0, costTime: 31 },
      { operId: 2, title: '站点管理', businessType: 1, requestMethod: 'POST', operName: 'ops_demo', operUrl: '/operator/station', status: 0, costTime: 24 },
      { operId: 3, title: '充电订单', businessType: 5, requestMethod: 'POST', operName: 'admin', operUrl: '/operator/order/export', status: 0, costTime: 56 }
    ].map((row, index) => ({ ...row, operIp: '192.0.2.31', operTime: dateAt(18 + index * 5) })),
    '/monitor/sys/list': [
      { id: 1, sysName: '运营服务（模拟）', ip: '192.0.2.21', cpuInfo: 18, cpuCoreInfo: 4, memInfo: 46, diskInfo: '80 GB', diskPercent: 32, isOnline: '0' },
      { id: 2, sysName: '报表服务（模拟）', ip: '192.0.2.22', cpuInfo: 11, cpuCoreInfo: 4, memInfo: 37, diskInfo: '120 GB', diskPercent: 24, isOnline: '0' },
      { id: 3, sysName: '备用节点（模拟）', ip: '192.0.2.23', cpuInfo: 0, cpuCoreInfo: 2, memInfo: 0, diskInfo: '60 GB', diskPercent: 12, isOnline: '1' }
    ],
    '/monitor/cache/list': [
      { id: 1, cacheName: '登录与权限缓存', ip: '192.0.2.41', ipPort: 6379, remark: '模拟会话与角色缓存配置' },
      { id: 2, cacheName: '设备状态缓存', ip: '192.0.2.42', ipPort: 6379, remark: '模拟充电桩在线状态与心跳' }
    ],
    '/file/ossConfig/list': [
      { id: 1, platformId: 'MinIO', bucketName: 'charge-fault-demo', basePath: 'repairs/', isDefault: '1' },
      { id: 2, platformId: 'S3', bucketName: 'charge-report-demo', basePath: 'reports/', isDefault: '0' }
    ].map(row => ({ ...row, accessKey: '演示占位', secretKey: '演示占位', endPoint: 'https://storage.example.invalid', domain: 'https://storage.example.invalid', status: '0' })),
    '/job/group/list': executors,
    '/job/info/list': tasks,
    '/job/log/list': taskLogs,
    '/code/gen/list': codeTables,
    '/code/gen/db/list': [{ tableName: 'c_operator_charge_whitelist', tableComment: '运营商启充会员白名单', createTime, updateTime: createTime }]
  }
}

export function prepareAdminSamples(db) {
  if (db.adminSamplesVersion === 1) return
  const replacePlaceholders = ['/system/dept/list', '/system/tenantpackage/list']
  for (const [url, examples] of Object.entries(exampleLists())) {
    const collection = db.lists[url] || {}
    const existing = collection.rows || collection.data || []
    const id = Object.keys(examples[0])[0]
    const data = replacePlaceholders.includes(url)
      ? [...existing.filter(row => row[id] != null && !examples.some(example => String(example[id]) === String(row[id]))), ...examples]
      : [...existing, ...examples.filter(example => !existing.some(row => String(row[id]) === String(example[id]) ||
        (example.dictType && !example.dictValue && row.dictType === example.dictType)))]
    db.lists[url] = { ...collection, code: 200, data, rows: data, total: data.length }
  }
  db.adminSamplesVersion = 1
}
