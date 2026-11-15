// Illustrative positions for bundled browser fixtures, not real device locations.
// Legacy station forms store longitude in `lat` and latitude in `lng`.
const legacy = [
  [68, 113.87, 22.57], [69, 114.24, 22.72], [70, 114.27, 22.74],
  [71, 121.45, 31.23], [72, 116.10, 39.94], [73, 118.76, 31.99],
  [77, 113.94, 22.54], [78, 116.36, 39.91], [79, 113.17, 40.04],
  [80, 118.79, 31.97], [83, 116.29, 39.85], [84, 121.40, 31.25],
  [85, 116.30, 39.98], [87, 116.60, 34.70], [92, 116.42, 39.93]
]
const generated = {
  DEMO_OV_CITY_1: [118.78, 32.06], DEMO_OV_CITY_2: [118.73, 32.09], DEMO_OV_CITY_3: [118.86, 32.05],
  DEMO_OV_CAMPUS_1: [120.12, 30.30], DEMO_OV_CAMPUS_2: [120.16, 30.27],
  DEMO_OV_PARK_1: [114.02, 22.55], DEMO_OV_PARK_2: [114.08, 22.59],
  DEMO_OV_PARK_3: [113.97, 22.58], DEMO_OV_PARK_4: [114.05, 22.53]
}

export function prepareDemoStationLocations(db) {
  const collection = db.lists['/operator/station/list'] || {}
  const stations = collection.rows || collection.data || []
  for (const station of stations) {
    // Preserve manually entered, partial, or invalid coordinates for correction.
    if ([station.lat, station.lng].some(value => value != null && String(value).trim() !== '')) continue
    let point = null
    if (station.createBy === 'DEMO_OV_V1' && String(station.stationName).startsWith('【演示】')) {
      point = generated[station.stationCode]
    } else if (db.demoStationLocationVersion !== 1 && Number(station.tenantId) === 9999) {
      const index = legacy.findIndex(row => row[0] === Number(station.stationId))
      if (index >= 0 && station.address === '示范路' + (index + 1) + '号' &&
          station.stationName === ['滨江示范', '科技园', '城市广场'][index % 3] + '充电站 ' + (index + 1)) {
        point = legacy[index].slice(1)
      }
    }
    if (point) {
      station.lat = String(point[0]); station.lng = String(point[1])
      station.coordinateSource = 'DEMO'
    }
  }
  db.demoStationLocationVersion = 1
}
