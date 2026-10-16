// Demo telemetry uses the backend units: amperes, watts, hours and kWh.
export function seedDemoPorts(ports, timestamp = Date.now()) {
  ports.forEach((port, index) => {
    const mode = [1, 1, 0, 5, 'offline'][index % 5]
    const current = [32, 68, 46, 54, 80][index % 5]
    const voltage = [412, 398, 406, 415, 392][index % 5]
    const minutes = [38.5, 26.4][index % 2] + Math.floor(index / 5) * 3
    const charging = mode === 1
    Object.assign(port, {
      runningStatus: mode === 'offline' ? 1 : 2,
      gunStatus: mode === 'offline' ? 0 : mode,
      gunInsert: charging || mode === 5 ? 1 : 0,
      useCount: 156 + index * 23,
      chargingCurrent: charging ? current : 0,
      chargingCdgl: charging ? current * voltage : 0,
      realHour: charging ? minutes / 60 : 0,
      consumePower: charging ? current * voltage / 1000 * minutes / 60 : 0,
      faultCode: mode === 5 ? 'CONNECTOR' : null,
      faultReason: mode === 5 ? '连接器温度异常，请安排检查' : '',
      _demoTelemetry: { at: timestamp, current, voltage }
    })
  })
}

export function refreshDemoPorts(ports, timestamp = Date.now()) {
  ports.forEach(port => {
    const telemetry = port._demoTelemetry
    if (!telemetry) return
    if (Number(port.runningStatus) !== 1 && Number(port.gunStatus) === 1) {
      const hours = Math.max(0, timestamp - telemetry.at) / 3600000
      port.chargingCurrent = telemetry.current
      port.chargingCdgl = telemetry.current * telemetry.voltage
      port.realHour = Number(port.realHour || 0) + hours
      port.consumePower = Number(port.consumePower || 0) + port.chargingCdgl / 1000 * hours
    } else {
      port.chargingCurrent = 0
      port.chargingCdgl = 0
    }
    telemetry.at = timestamp
  })
}

export function simulateDemoPorts(ports, action, args, timestamp = Date.now()) {
  const target = ports.filter(port => String(port.pileId) === String(args.pileId) &&
    (!args.deviceId || String(port.deviceId) === String(args.deviceId)))
  if (!target.length) return '没有匹配的模拟端口'
  if (!['start', 'stop', 'link', 'unlink', 'startCharge', 'endCharge'].includes(action)) return '不支持的模拟操作'
  // Validate the entire selection before changing any port.
  for (const port of target) {
    if (['link', 'startCharge'].includes(action) && Number(port.runningStatus) === 1) return '请先启动模拟充电桩'
    if (action === 'startCharge') {
      if (Number(port.gunStatus) === 5) return '端口存在故障，请选择正常端口'
      if (Number(port.gunInsert) !== 1) return '请先插枪'
      if (Number(port.gunStatus) === 1) return '端口正在充电，请勿重复启动'
    }
    if (action === 'unlink' && Number(port.gunStatus) === 1) return '请先停止充电再拔枪'
  }
  refreshDemoPorts(target, timestamp)
  target.forEach(port => {
    if (!port._demoTelemetry) port._demoTelemetry = { at: timestamp, current: 32, voltage: 412 }
    if (action === 'start') port.runningStatus = 2
    if (action === 'stop') {
      port.runningStatus = 1
      port.gunStatus = 0
    }
    if (action === 'link') port.gunInsert = 1
    if (action === 'unlink') {
      port.gunInsert = 0
      if (Number(port.gunStatus) !== 5) port.gunStatus = 0
    }
    if (action === 'startCharge') {
      port.gunStatus = 1
      port.useCount = Number(port.useCount || 0) + 1
      port.realHour = 0
      port.consumePower = 0
    }
    if (action === 'endCharge' && Number(port.gunStatus) === 1) port.gunStatus = 0
  })
  refreshDemoPorts(target, timestamp)
  return null
}
