import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import {
  collectNote,
  commitDialDigit,
  createGameState,
  selectInventoryItem,
  toggleInventory,
} from './game-state.js'

const host = document.querySelector('.bar-scene')
const status = document.querySelector('.bar-scene__status')
const hint = document.querySelector('.bar-scene__hint')
const interactionPrompt = document.querySelector('.bar-scene__interaction')
const dialDialog = document.querySelector('.bar-scene__dial')
const dialWheel = document.querySelector('.bar-scene__dial-wheel')
const dialNumber = document.querySelector('.bar-scene__dial-number')
const dialSlots = [...document.querySelectorAll('.bar-scene__slots span')]
const inventoryDrawer = document.querySelector('.bar-scene__inventory')
const inventoryHandle = document.querySelector('.bar-scene__inventory-handle')
const inventoryItems = document.querySelector('.bar-scene__inventory-items')
const itemDetail = document.querySelector('.bar-scene__item-detail')
const touchMode = matchMedia('(pointer: coarse)').matches
const maxDpr = touchMode ? 1.25 : 1.5

if (touchMode) hint.textContent = '拖动转头 · 点击地面移动 · F 互动 · E 收集栏'

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
const EYE_HEIGHT = 1.75
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
let gameState = createGameState()
let interactionTarget = null
let interactionObjects = []
let seatedAt = null
let standingReturn = null
let cameraTransition = null
let dialMode = false
let dialAngle = 0
let dialDigit = 0
let dialDragX = null
let safeDoor = null
let safeDial = null
let safeNote = null
let safeDoorBaseY = 0
let safeDialBaseZ = 0
let standingPitch = pitch
let inventoryPreviewRenderer = null
let inventoryPreviewScene = null
let inventoryPreviewCamera = null
let inventoryPreviewModel = null
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
  if (dialMode) return
  yaw += deltaYaw
  pitch = THREE.MathUtils.clamp(pitch + deltaPitch, -MAX_PITCH, MAX_PITCH)
  applyLook()
}

function updateMovement(deltaTime) {
  if (seatedAt || dialMode || cameraTransition) return
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

function createInventoryPreview() {
  if (!safeNote) return null
  if (!inventoryPreviewRenderer) {
    inventoryPreviewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    inventoryPreviewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    inventoryPreviewRenderer.setSize(72, 72, false)
    inventoryPreviewRenderer.outputColorSpace = THREE.SRGBColorSpace
    inventoryPreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping
    inventoryPreviewRenderer.toneMappingExposure = 1.15
    inventoryPreviewRenderer.domElement.className = 'bar-scene__inventory-preview'
    inventoryPreviewRenderer.domElement.setAttribute('aria-hidden', 'true')

    inventoryPreviewScene = new THREE.Scene()
    inventoryPreviewScene.add(new THREE.HemisphereLight(0xfff1d0, 0x25291d, 2.4))
    const keyLight = new THREE.DirectionalLight(0xffd79c, 3.2)
    keyLight.position.set(-1, 1.5, 2)
    inventoryPreviewScene.add(keyLight)

    inventoryPreviewCamera = new THREE.PerspectiveCamera(28, 1, .01, 10)
    inventoryPreviewCamera.position.set(.45, .35, 2.4)
    inventoryPreviewCamera.lookAt(0, 0, 0)

    inventoryPreviewModel = new THREE.Group()
    const noteModel = safeNote.clone(true)
    noteModel.visible = true
    noteModel.traverse((object) => { object.visible = true })
    inventoryPreviewModel.add(noteModel)
    inventoryPreviewScene.add(inventoryPreviewModel)
    inventoryPreviewModel.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(inventoryPreviewModel)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    noteModel.position.sub(center)
    inventoryPreviewModel.scale.setScalar(1.55 / Math.max(size.x, size.y, size.z))
    inventoryPreviewModel.rotation.set(-.08, -.18, -.04)
  }
  inventoryPreviewRenderer.render(inventoryPreviewScene, inventoryPreviewCamera)
  return inventoryPreviewRenderer.domElement
}

function renderGameState() {
  dialSlots.forEach((slot, index) => {
    slot.textContent = gameState.dialDigits[index] ?? '–'
  })
  dialNumber.textContent = String(dialDigit)
  inventoryDrawer.classList.toggle('is-open', gameState.inventoryOpen)
  inventoryHandle.setAttribute('aria-expanded', String(gameState.inventoryOpen))
  inventoryItems.replaceChildren(...gameState.inventory.map((item) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'bar-scene__inventory-item'
    button.dataset.itemId = item.id
    button.title = item.label
    button.setAttribute('aria-label', item.label)
    const preview = createInventoryPreview()
    if (preview) button.append(preview)
    return button
  }))
  const selected = gameState.inventory.find((item) => item.id === gameState.selectedItemId)
  itemDetail.textContent = selected?.text ?? ''
}

function setCameraTransition(destination, onComplete, {
  duration = .65,
  targetPitch = pitch,
  pitchArc = 0,
} = {}) {
  cameraTransition = {
    from: camera.position.clone(),
    to: destination.clone(),
    elapsed: 0,
    duration,
    fromPitch: pitch,
    targetPitch,
    pitchArc,
    onComplete,
  }
  walkTarget = null
  keys.clear()
}

function updateCameraTransition(deltaTime) {
  if (!cameraTransition) return
  cameraTransition.elapsed += deltaTime
  const progress = Math.min(cameraTransition.elapsed / cameraTransition.duration, 1)
  const eased = progress * progress * (3 - 2 * progress)
  camera.position.lerpVectors(cameraTransition.from, cameraTransition.to, eased)
  pitch = THREE.MathUtils.lerp(cameraTransition.fromPitch, cameraTransition.targetPitch, eased) +
    Math.sin(progress * Math.PI) * cameraTransition.pitchArc
  applyLook()
  if (progress < 1) return
  const onComplete = cameraTransition.onComplete
  cameraTransition = null
  onComplete?.()
}

function findInteractionTarget() {
  if (dialMode || cameraTransition) return null
  if (seatedAt) return { type: 'stand', object: seatedAt, prompt: 'F 起身' }

  const direction = new THREE.Vector3()
  const position = new THREE.Vector3()
  camera.getWorldDirection(direction)
  let best = null
  for (const candidate of interactionObjects) {
    if (candidate.type === 'safe' && gameState.safeUnlocked) continue
    if (candidate.type === 'note' && (!gameState.safeUnlocked || gameState.noteCollected)) continue
    candidate.object.getWorldPosition(position)
    const offset = position.clone().sub(camera.position)
    const distance = offset.length()
    if (distance > 1.55 || direction.dot(offset.normalize()) < .82) continue
    if (!best || distance < best.distance) best = { ...candidate, distance }
  }
  return best
}

function updateInteractionPrompt() {
  interactionTarget = findInteractionTarget()
  interactionPrompt.textContent = interactionTarget?.prompt ?? ''
  interactionPrompt.classList.toggle('is-visible', Boolean(interactionTarget))
}

function sitDown(seat) {
  standingReturn = camera.position.clone()
  standingPitch = pitch
  const destination = new THREE.Vector3()
  seat.getWorldPosition(destination)
  setCameraTransition(destination, () => { seatedAt = seat }, {
    duration: .9,
    targetPitch: 0,
    pitchArc: -.16,
  })
}

function standUp() {
  const destination = standingReturn?.clone() ?? startPosition.clone()
  destination.y = EYE_HEIGHT
  const seat = seatedAt
  seatedAt = null
  setCameraTransition(destination, () => { standingReturn = null }, {
    duration: .72,
    targetPitch: standingPitch,
    pitchArc: .07,
  })
  interactionTarget = { type: 'seat', object: seat, prompt: 'F 坐下' }
}

function openDial() {
  dialMode = true
  keys.clear()
  walkTarget = null
  dialDialog.hidden = false
  if (document.pointerLockElement) document.exitPointerLock()
  renderGameState()
}

function closeDial() {
  dialMode = false
  dialDragX = null
  dialDialog.hidden = true
}

function commitCurrentDigit() {
  if (!dialMode || gameState.safeUnlocked) return
  gameState = commitDialDigit(gameState, dialDigit)
  if (gameState.dialFeedback === 'error') {
    dialWheel.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
      { duration: 260 },
    )
  } else if (gameState.safeUnlocked) {
    dialAngle += Math.PI * 2
    setTimeout(closeDial, 420)
  }
  renderGameState()
}

function performInteraction() {
  if (dialMode) {
    commitCurrentDigit()
    return
  }
  if (!interactionTarget) return
  if (interactionTarget.type === 'seat') sitDown(interactionTarget.object)
  if (interactionTarget.type === 'stand') standUp()
  if (interactionTarget.type === 'safe') openDial()
  if (interactionTarget.type === 'note') {
    gameState = collectNote(gameState)
    safeNote.visible = !gameState.noteCollected
    renderGameState()
  }
}

function toggleInventoryDrawer() {
  gameState = toggleInventory(gameState)
  renderGameState()
}

function updateSafeAnimation(deltaTime) {
  if (!safeDoor || !safeDial) return
  const doorTarget = safeDoorBaseY + (gameState.safeUnlocked ? -1.55 : 0)
  safeDoor.rotation.y = THREE.MathUtils.damp(safeDoor.rotation.y, doorTarget, 5, deltaTime)
  safeDial.rotation.z = THREE.MathUtils.damp(safeDial.rotation.z, safeDialBaseZ + dialAngle, 10, deltaTime)
}

function resize() {
  const width = host.clientWidth
  const height = host.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

new GLTFLoader().load('/models/cozy_bar_v005-7a643cd5.glb', (gltf) => {
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
  const seatNames = ['SeatInteract_1', 'SeatInteract_2', 'SeatInteract_3', 'SeatInteract_4']
  interactionObjects = seatNames.map((name) => ({
    type: 'seat',
    object: gltf.scene.getObjectByName(name),
    prompt: 'F 坐下',
  }))
  safeDoor = gltf.scene.getObjectByName('SafeDoor')
  safeDial = gltf.scene.getObjectByName('SafeDial')
  safeNote = gltf.scene.getObjectByName('SafeNote')
  interactionObjects.push(
    { type: 'safe', object: gltf.scene.getObjectByName('SafeInteract'), prompt: 'F 使用拨盘' },
    { type: 'note', object: safeNote, prompt: 'F 拾取纸条' },
  )
  safeDoorBaseY = safeDoor.rotation.y
  safeDialBaseZ = safeDial.rotation.z
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
  if (!touchMode && !dialMode) renderer.domElement.requestPointerLock()
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
  if (event.repeat) return
  if (event.code === 'KeyF') {
    host.classList.add('has-interacted')
    performInteraction()
    event.preventDefault()
  }
  if (event.code === 'KeyE') {
    host.classList.add('has-interacted')
    toggleInventoryDrawer()
    event.preventDefault()
  }
  if (event.code === 'Escape' && dialMode) closeDial()
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
  if (!touchStart.moved && floorTargets.length && !seatedAt && !cameraTransition && !dialMode) {
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

dialWheel.addEventListener('pointerdown', (event) => {
  dialDragX = event.clientX
  dialWheel.setPointerCapture(event.pointerId)
})
dialWheel.addEventListener('pointermove', (event) => {
  if (dialDragX === null) return
  const deltaX = event.clientX - dialDragX
  dialDragX = event.clientX
  dialAngle += deltaX * .025
  dialDigit = ((Math.round(dialAngle / (Math.PI * 2) * 10) % 10) + 10) % 10
  dialNumber.textContent = String(dialDigit)
})
dialWheel.addEventListener('pointerup', () => { dialDragX = null })
dialWheel.addEventListener('pointercancel', () => { dialDragX = null })
document.querySelector('.bar-scene__close').addEventListener('click', closeDial)
inventoryHandle.addEventListener('click', toggleInventoryDrawer)
inventoryItems.addEventListener('click', (event) => {
  const itemId = event.target.closest('[data-item-id]')?.dataset.itemId
  if (!itemId) return
  gameState = selectInventoryItem(gameState, itemId)
  renderGameState()
})
document.querySelector('[data-action="interact"]').addEventListener('click', () => {
  host.classList.add('has-interacted')
  performInteraction()
})
document.querySelector('[data-action="inventory"]').addEventListener('click', () => {
  host.classList.add('has-interacted')
  toggleInventoryDrawer()
})

new ResizeObserver(resize).observe(host)
applyLook()
renderGameState()
resize()
renderer.setAnimationLoop(() => {
  const deltaTime = Math.min(clock.getDelta(), .2)
  if (document.visibilityState === 'hidden') return
  updateCameraTransition(deltaTime)
  updateMovement(deltaTime)
  updateSafeAnimation(deltaTime)
  updateInteractionPrompt()
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
    seated: Boolean(seatedAt),
    dialMode,
    gameState,
    interaction: interactionTarget?.type ?? null,
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
    seatedAt = null
    standingReturn = null
    cameraTransition = null
    gameState = createGameState()
    dialMode = false
    dialAngle = 0
    dialDigit = 0
    if (safeNote) safeNote.visible = true
    closeDial()
    renderGameState()
    applyLook()
  },
  interact: performInteraction,
  toggleInventory: toggleInventoryDrawer,
  setDialDigit: (digit) => {
    dialDigit = ((Math.round(digit) % 10) + 10) % 10
    renderGameState()
  },
  setWalkTarget: (x, z) => {
    const target = clampPosition(new THREE.Vector3(x, EYE_HEIGHT, z))
    if (!hitsCounter(target)) walkTarget = target
  },
  bounds: { roomBounds, counterBounds, MAX_PITCH },
}
