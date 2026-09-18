import * as THREE from 'three'

const VISUALS = Object.freeze({
  locked: { intensity: .05, color: 0x182226 },
  unlocked: { intensity: .35, color: 0x2d7380 },
  loading: { intensity: .75, color: 0x56b9c8 },
  ready: { intensity: 2.8, color: 0xb7ffff },
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
  const material = new THREE.MeshStandardMaterial({
    name: 'Pool portal screen',
    map: texture,
    emissiveMap: texture,
    roughness: .38,
  })
  screen.material = material
  return {
    screen,
    material,
    setStatus(status) {
      const visual = getPortalScreenVisual(status)
      material.emissive.setHex(visual.color)
      material.emissiveIntensity = visual.intensity
      material.color.setScalar(status === 'error' ? .3 : status === 'ready' || status === 'entering' ? 1 : .55)
    },
  }
}
