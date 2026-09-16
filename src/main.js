import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

const host = document.querySelector('.bar-scene')
const status = document.querySelector('.bar-scene__status')
const hint = document.querySelector('.bar-scene__hint')
const touchMode = matchMedia('(pointer: coarse)').matches
const maxDpr = touchMode ? 1.25 : 1.5

if (touchMode) hint.textContent = '拖动转头 · 点击地面移动'

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = .42
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
host.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x030507)
scene.add(new THREE.HemisphereLight(0x304d73, 0x160a04, .34))
RectAreaLightUniformsLib.init()

function addAreaLight({ name, color, intensity, width, height, position, target }) {
  const area = new THREE.RectAreaLight(color, intensity, width, height)
  area.name = name
  area.position.fromArray(position)
  area.lookAt(...target)
  scene.add(area)
  return area
}

const webLightRig = [
  { name: 'moonlight', color: 0x719bd8, intensity: 6.2, width: 3.2, height: 2.2,
    position: [-4.65, 2.35, .25], target: [-1.2, .7, -.3] },
  { name: 'ceilingWarmth', color: 0xff9d54, intensity: 1.15, width: 3.6, height: 2.6,
    position: [0, 3.37, .3], target: [0, .35, -1] },
  { name: 'shelfGlow', color: 0xff7a2c, intensity: 2.7, width: 1.6, height: 1,
    position: [1.1, 3.17, -2.1], target: [1, 1.7, -2.5] },
  { name: 'neonWash', color: 0xff3508, intensity: 1.4, width: .75, height: .35,
    position: [-2.82, 3, -2.62], target: [-2.82, 3, -2.95] },
  { name: 'counterPool', color: 0xff6825, intensity: 2, width: 1.4, height: 1,
    position: [.7, 2.45, -.25], target: [.7, 1.1, -.8] },
]
webLightRig.forEach(addAreaLight)

const moonShadow = new THREE.DirectionalLight(0x779bd4, .32)
moonShadow.position.set(-4.8, 2.8, .4)
moonShadow.target.position.set(-.8, .55, -.35)
moonShadow.castShadow = true
moonShadow.shadow.mapSize.set(1024, 1024)
scene.add(moonShadow, moonShadow.target)

const camera = new THREE.PerspectiveCamera(58, 1, .05, 50)
const EYE_HEIGHT = 1.68
const MAX_PITCH = THREE.MathUtils.degToRad(70)
const roomBounds = { minX: -3.72, maxX: 3.72, minZ: -2.72, maxZ: 2.72 }
const counterBounds = { minX: -2.05, maxX: 3.62, minZ: -1.82, maxZ: -.15 }
const playerRadius = .2
const movementSpeed = 2.8
const keys = new Set()
const clock = new THREE.Clock()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const startPosition = new THREE.Vector3(.15, EYE_HEIGHT, 2.48)
let yaw = 0
let pitch = .08
let walkTarget = null
let floorTargets = []
let touchStart = null
let shadowFramesRemaining = 2
camera.position.copy(startPosition)

function applyLook() {
  camera.rotation.order = 'YXZ'
  camera.rotation.y = yaw
  camera.rotation.x = pitch
}

function clampPosition(position) {
  position.x = THREE.MathUtils.clamp(position.x, roomBounds.minX, roomBounds.maxX)
  position.z = THREE.MathUtils.clamp(position.z, roomBounds.minZ, roomBounds.maxZ)
  position.y = EYE_HEIGHT
  return position
}

function hitsCounter(position) {
  return position.x > counterBounds.minX - playerRadius &&
    position.x < counterBounds.maxX + playerRadius &&
    position.z > counterBounds.minZ - playerRadius &&
    position.z < counterBounds.maxZ + playerRadius
}

function tryMove(delta) {
  const start = camera.position.clone()
  const candidateX = clampPosition(start.clone().add(new THREE.Vector3(delta.x, 0, 0)))
  if (!hitsCounter(candidateX)) camera.position.copy(candidateX)
  const candidateZ = clampPosition(camera.position.clone().add(new THREE.Vector3(0, 0, delta.z)))
  if (!hitsCounter(candidateZ)) camera.position.copy(candidateZ)
  camera.position.y = EYE_HEIGHT
}

function lookBy(deltaYaw, deltaPitch) {
  yaw += deltaYaw
  pitch = THREE.MathUtils.clamp(pitch + deltaPitch, -MAX_PITCH, MAX_PITCH)
  applyLook()
}

function updateMovement(deltaTime) {
  const forwardAmount = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
  const rightAmount = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
  if (forwardAmount || rightAmount) {
    walkTarget = null
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const motion = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount))
    tryMove(motion.normalize().multiplyScalar(movementSpeed * deltaTime))
  } else if (walkTarget) {
    const motion = walkTarget.clone().sub(camera.position)
    motion.y = 0
    const remaining = motion.length()
    if (remaining < .025) walkTarget = null
    else tryMove(motion.normalize().multiplyScalar(Math.min(remaining, movementSpeed * deltaTime)))
  }
}

function resize() {
  const width = host.clientWidth
  const height = host.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

new GLTFLoader().load('/models/cozy_bar_v004.glb', (gltf) => {
  scene.add(gltf.scene)
  gltf.scene.traverse((object) => {
    if (object.isPointLight) {
      object.decay = 2
      object.distance = object.name.startsWith('Neon accent') ? 1.15 : 1.7
      object.intensity *= .45
    }
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    if (object.name.startsWith('Floor plank')) floorTargets.push(object)
  })
  renderer.shadowMap.autoUpdate = true
  renderer.shadowMap.needsUpdate = true
  shadowFramesRemaining = 2
  host.classList.add('is-loaded')
  status.textContent = '场景已载入'
}, (event) => {
  if (event.total) status.textContent = `正在进入酒吧... ${Math.round(event.loaded / event.total * 100)}%`
}, () => {
  status.textContent = '场景载入失败'
})

renderer.domElement.addEventListener('click', () => {
  if (!touchMode) renderer.domElement.requestPointerLock()
})
document.addEventListener('pointerlockchange', () => {
  const active = document.pointerLockElement === renderer.domElement
  host.classList.toggle('is-active', active)
  if (active) host.classList.add('has-interacted')
})
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === renderer.domElement) {
    lookBy(-event.movementX * .002, -event.movementY * .002)
  }
})
addEventListener('keydown', (event) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    keys.add(event.code)
    host.classList.add('has-interacted')
    event.preventDefault()
  }
})
addEventListener('keyup', (event) => keys.delete(event.code))

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return
  touchStart = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  }
  renderer.domElement.setPointerCapture(event.pointerId)
})
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!touchStart || event.pointerType !== 'touch') return
  const dx = event.clientX - touchStart.lastX
  const dy = event.clientY - touchStart.lastY
  if (Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8) {
    touchStart.moved = true
  }
  if (touchStart.moved) lookBy(-dx * .005, -dy * .005)
  touchStart.lastX = event.clientX
  touchStart.lastY = event.clientY
  host.classList.add('has-interacted')
})
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!touchStart || event.pointerType !== 'touch') return
  if (!touchStart.moved && floorTargets.length) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(floorTargets, false)[0]
    if (hit) {
      const target = clampPosition(new THREE.Vector3(hit.point.x, EYE_HEIGHT, hit.point.z))
      if (!hitsCounter(target)) walkTarget = target
    }
  }
  touchStart = null
})

new ResizeObserver(resize).observe(host)
applyLook()
resize()
renderer.setAnimationLoop(() => {
  const deltaTime = Math.min(clock.getDelta(), .2)
  if (document.visibilityState === 'hidden') return
  updateMovement(deltaTime)
  renderer.render(scene, camera)
  if (shadowFramesRemaining > 0) {
    shadowFramesRemaining -= 1
    if (shadowFramesRemaining === 0) renderer.shadowMap.autoUpdate = false
  }
})

window.barTour = {
  getState: () => ({
    position: camera.position.toArray(),
    yaw,
    pitch,
    loaded: host.classList.contains('is-loaded'),
  }),
  getPerformance: () => ({
    pixelRatio: renderer.getPixelRatio(),
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    maxDpr,
    triangles: renderer.info.render.triangles,
  }),
  lookBy,
  moveBy: (x, z) => tryMove(new THREE.Vector3(x, 0, z)),
  reset: () => {
    camera.position.copy(startPosition)
    yaw = 0
    pitch = .08
    walkTarget = null
    applyLook()
  },
  setWalkTarget: (x, z) => {
    const target = clampPosition(new THREE.Vector3(x, EYE_HEIGHT, z))
    if (!hitsCounter(target)) walkTarget = target
  },
  bounds: { roomBounds, counterBounds, MAX_PITCH },
}
