import * as THREE from 'three'

const VISUALS = Object.freeze({
  locked: { intensity: .05, color: 0x182226 },
  unlocked: { intensity: .35, color: 0x2d7380 },
  loading: { intensity: .75, color: 0x56b9c8 },
  ready: { intensity: .15, color: 0xb7ffff },
  error: { intensity: 1.5, color: 0xff3028 },
  entering: { intensity: 5.5, color: 0xd8ffff },
  completed: { intensity: 0, color: 0x000000 },
})

export function getPortalScreenVisual(status) {
  return VISUALS[status] ?? VISUALS.locked
}

export function createPortalScreenController(screen, texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.repeat.set(4, 4)
  texture.offset.set(-1.5, -2)
  const material = new THREE.MeshBasicMaterial({
    name: 'Pool portal screen',
    map: texture,
    toneMapped: true,
  })
  screen.material = material
  return {
    screen,
    material,
    setStatus(status) {
      const visual = getPortalScreenVisual(status)
      material.color.setHex(status === 'error' ? 0xff6666 : 0xffffff)
      material.color.multiplyScalar(status === 'ready' ? .72 : status === 'entering' ? .9 : .42)
      material.userData.portalVisual = visual
    },
  }
}
