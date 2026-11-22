// Three.js r160 is self-hosted and shared by the login and atlas scenes.
let runtimePromise
export function loadThree() {
  if (window.THREE && window.THREE.REVISION === '160') return Promise.resolve(window.THREE)
  if (!runtimePromise) {
    runtimePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      const timeout = setTimeout(() => {
        script.remove()
        reject(new Error('Energy runtime timeout'))
      }, 15000)
      script.src = process.env.BASE_URL + 'vendor/three-r160.min.js'
      script.async = true
      script.onload = () => {
        clearTimeout(timeout)
        if (window.THREE && window.THREE.REVISION === '160') resolve(window.THREE)
        else reject(new Error('Energy runtime unavailable'))
      }
      script.onerror = () => {
        clearTimeout(timeout)
        script.remove()
        reject(new Error('Energy runtime unavailable'))
      }
      document.head.appendChild(script)
    }).catch(error => {
      runtimePromise = null
      throw error
    })
  }
  return runtimePromise
}
