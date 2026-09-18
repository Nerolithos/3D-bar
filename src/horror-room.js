import * as THREE from 'three'

export const HORROR_TV_MODEL_URL = '/models/interactive/tv-9d401ae2.glb'

export const HORROR_TV_LAYOUT = Object.freeze([
  { position: [-1.35, .33, -.55], rotation: [0, 2.82, -.08] },
  { position: [-.65, .31, -.72], rotation: [.08, 3.42, .12] },
  { position: [.08, .34, -.62], rotation: [0, 2.96, -.05] },
  { position: [.82, .33, -.48], rotation: [-.06, 3.28, .09] },
  { position: [1.42, .32, -.12], rotation: [0, 2.72, -.12] },
  { position: [-1.02, .7, .08], rotation: [.12, 3.2, .2] },
  { position: [-.25, .76, -.02], rotation: [-.1, 2.9, -.18] },
  { position: [.55, .72, .14], rotation: [.18, 3.38, .14] },
  { position: [1.08, .7, .48], rotation: [0, 3.05, Math.PI] },
  { position: [-.62, 1.12, .42], rotation: [Math.PI / 2, 2.75, .08] },
  { position: [.18, 1.18, .46], rotation: [-.14, 3.35, -.22] },
  { position: [.68, 1.5, .52], rotation: [-Math.PI / 2, 2.95, .16] },
])

export function addHorrorTvPile(horrorRoot, sourceRoot) {
  const pile = new THREE.Group()
  pile.name = 'HorrorTvPile'
  HORROR_TV_LAYOUT.forEach(({ position, rotation }, index) => {
    const television = sourceRoot.clone(true)
    television.name = `HorrorTV_${String(index + 1).padStart(2, '0')}`
    television.position.fromArray(position)
    television.rotation.set(...rotation)
    pile.add(television)
  })
  horrorRoot.add(pile)
  return pile
}

export function addHorrorScreenLights(horrorRoot, limit = 12) {
  const televisionScreens = []
  const wallScreens = []
  horrorRoot.traverse((object) => {
    if (object.name.startsWith('TVScreen')) televisionScreens.push(object)
    else if (object.name.startsWith('CRTScreen')) wallScreens.push(object)
  })

  const selectedTelevisions = televisionScreens.slice(0, Math.min(4, limit))
  const wallLightCount = Math.min(wallScreens.length, Math.max(0, limit - selectedTelevisions.length))
  const selectedWallScreens = Array.from({ length: wallLightCount }, (_, index) => (
    wallScreens[Math.round(index * (wallScreens.length - 1) / Math.max(1, wallLightCount - 1))]
  ))
  const screens = [...selectedTelevisions, ...selectedWallScreens]
  horrorRoot.updateMatrixWorld(true)
  const roomCenter = new THREE.Vector3(0, 1.4, 0)
  return screens.map((screen, index) => {
    const screenPosition = screen.getWorldPosition(new THREE.Vector3())
    horrorRoot.worldToLocal(screenPosition)
    const inward = roomCenter.clone().sub(screenPosition)
    if (inward.lengthSq() < .01) inward.set(0, .2, 1)
    const light = new THREE.PointLight(index % 2 ? 0xd9e3d9 : 0xb8d4cf, 18, 4.8, 2)
    light.name = `HorrorScreenLight_${String(index + 1).padStart(2, '0')}`
    light.position.copy(screenPosition).add(inward.normalize().multiplyScalar(.22))
    light.castShadow = false
    light.userData.screenType = screen.name.startsWith('TVScreen') ? 'TV' : 'CRT'
    light.userData.screenName = screen.name
    horrorRoot.add(light)
    return light
  })
}

export function updateHorrorEntranceDoor(pivot, deltaTime) {
  if (!pivot) return
  pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, 0, 3.2, deltaTime)
  if (Math.abs(pivot.rotation.y) < .002) pivot.rotation.y = 0
}
