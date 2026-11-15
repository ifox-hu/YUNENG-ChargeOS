import { stationPosition } from './data'

// Local geographic geometry only. Decorative particles carry no operational meaning.
export function createAtlas(stage, T, geo, onHover, onLost) {
  const scene = new T.Scene()
  const camera = new T.OrthographicCamera(-40, 40, 28, -28, 0.1, 250)
  camera.position.set(0, -48, 65); camera.lookAt(0, 0, 0)
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(2.5, Math.max(2, window.devicePixelRatio || 1)))
  renderer.setClearColor(0x000000, 0)
  stage.appendChild(renderer.domElement)
  const world = new T.Group(); scene.add(world)
  const map = new T.Group(); world.add(map)
  const markers = new T.Group(); world.add(markers)
  scene.add(new T.AmbientLight(0xa4dcff, 1.7))
  const light = new T.DirectionalLight(0x51cfff, 3.5); light.position.set(-15, 25, 50); scene.add(light)
  const project = p => new T.Vector2((p[0] - 104) * 0.95, (Math.log(Math.tan(Math.PI / 4 + p[1] * Math.PI / 360)) * 180 / Math.PI - 36) * 0.8)
  const provinces = []; const pulses = []
  let dead = false; let frame = 0; let motion = true; let time = 0; let last = 0
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  const ringMaterial = new T.LineBasicMaterial({ color: 0x156b95, transparent: true, opacity: 0.5 })
  for (const radius of [25, 29, 33]) {
    const points = Array.from({ length: 181 }, (_, i) => new T.Vector3(Math.cos(i * Math.PI / 90) * radius, Math.sin(i * Math.PI / 90) * radius * 0.75, -1.8))
    world.add(new T.Line(new T.BufferGeometry().setFromPoints(points), ringMaterial))
  }
  const grid = new T.GridHelper(74, 30, 0x124265, 0x0b2943); grid.rotation.x = Math.PI / 2; grid.position.z = -2; grid.material.transparent = true; grid.material.opacity = 0.38; world.add(grid)
  geo.features.filter(f => f.geometry && f.geometry.coordinates).forEach(feature => {
    const entry = { feature, meshes: [], count: 0 }
    const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates]
    polygons.forEach(rings => {
      if (!rings[0] || rings[0].length < 4) return
      const path = (ring, shape) => {
        let previous
        ring.forEach((coord, i) => {
          const p = project(coord)
          if (i !== ring.length - 1 && previous && p.distanceTo(previous) < 0.045) return
          if (!previous) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y)
          previous = p
        })
        shape.closePath()
      }
      const shape = new T.Shape(); path(rings[0], shape)
      rings.slice(1).forEach(ring => { const hole = new T.Path(); path(ring, hole); shape.holes.push(hole) })
      const geometry = new T.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false, steps: 1, curveSegments: 1 })
      const top = new T.MeshStandardMaterial({ color: 0x123d63, roughness: 0.45, metalness: 0.45 })
      const side = new T.MeshStandardMaterial({ color: 0x062944, roughness: 0.4, metalness: 0.7 })
      const mesh = new T.Mesh(geometry, [top, side]); mesh.userData.province = entry; map.add(mesh)
      const line = new T.LineSegments(new T.EdgesGeometry(geometry, 50), new T.LineBasicMaterial({ color: 0x2daed5, transparent: true, opacity: 0.5 }))
      map.add(line); entry.meshes.push(mesh)
    })
    provinces.push(entry)
  })
  const starPositions = []
  for (let i = 0; i < 400; i++) starPositions.push(Math.sin(i * 127.1) * 65, Math.cos(i * 311.7) * 48, Math.sin(i * 71.2) * 13 - 4)
  const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(starPositions, 3)), new T.PointsMaterial({ color: 0x55bfea, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }))
  scene.add(stars)
  const orbit = new T.Group(); world.add(orbit)
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3
    const dot = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0x39dcff }))
    dot.position.set(Math.cos(angle) * 29, Math.sin(angle) * 29 * 0.75, -1.6); orbit.add(dot)
  }
  const raycaster = new T.Raycaster(); const pointer = new T.Vector2()
  const disposeObject = object => {
    object.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose()) })
  }
  function draw() {
    if (dead) return
    renderer.render(scene, camera)
  }
  function tick(now) {
    frame = 0
    if (dead || !motion || media.matches || document.hidden) return
    time += last ? Math.min((now - last) / 1000, 0.06) : 0; last = now
    stars.rotation.z = time * 0.006
    orbit.rotation.z = -time * 0.12
    pulses.forEach((p, i) => { const phase = (time * 0.6 + i * 0.21) % 1; p.scale.setScalar(0.7 + phase * 1.5); p.material.opacity = (1 - phase) * 0.65 })
    draw(); frame = requestAnimationFrame(tick)
  }
  function resume() { cancelAnimationFrame(frame); frame = 0; last = 0; draw(); if (!dead && motion && !media.matches && !document.hidden) frame = requestAnimationFrame(tick) }
  function resize() {
    const w = stage.clientWidth || 600; const h = stage.clientHeight || 450; const aspect = w / h
    // Fit the complete geographic bounds, including offshore islands, at every aspect ratio.
    camera.updateMatrixWorld(true)
    const box = new T.Box3().setFromObject(map)
    const view = new T.Box3()
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) view.expandByPoint(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
    const center = view.getCenter(new T.Vector3())
    const height = Math.max((view.max.y - view.min.y) * 1.2, (view.max.x - view.min.x) * 1.16 / aspect)
    // A small leftward composition shift stays within the geographic fit padding.
    const horizontalOffset = height * aspect * 0.035
    camera.left = center.x + horizontalOffset - height * aspect / 2; camera.right = center.x + horizontalOffset + height * aspect / 2
    camera.top = center.y + height / 2; camera.bottom = center.y - height / 2; camera.updateProjectionMatrix()
    const pixelRatio = Math.min(2.5, Math.max(2, window.devicePixelRatio || 1))
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio)
    renderer.setSize(w, h, false); draw()
  }
  function move(event) {
    const rect = stage.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(map.children).find(h => h.object.userData.province)
    onHover(hit ? hit.object.userData.province.feature.properties.name + ' · ' + hit.object.userData.province.count + ' 个站点' : '')
  }
  function clearHover() { onHover('') }
  function lost(event) { event.preventDefault(); onLost() }
  const observer = new ResizeObserver(resize); observer.observe(stage)
  document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume)
  stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', clearHover)
  renderer.domElement.addEventListener('webglcontextlost', lost)
  resize(); resume()
  return {
    update(stations) {
      if (dead) return
      while (markers.children.length) { const c = markers.children[0]; markers.remove(c); disposeObject(c) }
      pulses.splice(0)
      const max = Math.max(1, ...provinces.map(p => stations.filter(s => String(s.regionCode || '').slice(0, 2) === String(p.feature.properties.adcode).slice(0, 2) || s.province === p.feature.properties.name).length))
      provinces.forEach(p => {
        p.count = stations.filter(s => String(s.regionCode || '').slice(0, 2) === String(p.feature.properties.adcode).slice(0, 2) || s.province === p.feature.properties.name).length
        p.meshes.forEach(mesh => { mesh.material[0].color.set(p.count ? 0x147ca8 : 0x123d63); mesh.material[0].emissive.set(p.count ? 0x063247 : 0x000000) })
        const center = p.feature.properties.centroid || p.feature.properties.center
        if (!p.count || !center) return
        const point = project(center); const height = 1.2 + p.count / max * 3.5
        const bar = new T.Mesh(new T.CylinderGeometry(0.09, 0.3, height, 8), new T.MeshBasicMaterial({ color: 0x37e6f2, transparent: true, opacity: 0.78 })); bar.rotation.x = Math.PI / 2; bar.position.set(point.x, point.y, 1.9 + height / 2); markers.add(bar)
        const ring = new T.Mesh(new T.RingGeometry(0.4, 0.47, 32), new T.MeshBasicMaterial({ color: 0x31f5ff, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false })); ring.position.set(point.x, point.y, 1.94); markers.add(ring); pulses.push(ring)
      })
      stations.forEach(station => { const coordinate = stationPosition(station); if (!coordinate) return; const p = project(coordinate); const dot = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xffcc79 })); dot.position.set(p.x, p.y, 1.98); markers.add(dot) })
      draw()
    },
    setMotion(value) { motion = value; resume() },
    dispose() {
      if (dead) return
      dead = true; cancelAnimationFrame(frame); observer.disconnect()
      document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume)
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', clearHover); renderer.domElement.removeEventListener('webglcontextlost', lost)
      disposeObject(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    }
  }
}
