import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import {
  DOOR_SYMBOLS,
  collectIceGlass,
  collectNote,
  collectRevealedNote,
  commitDoorSymbol,
  commitDialDigit,
  createGameState,
  insertCiderCard,
  insertWetNote,
  setHorrorRoomStatus,
  meltHeldGlass,
  pickupPlacedNote,
  pickupPlacedGlass,
  placeHeldGlass,
  placeHeldNote,
} from './game-state.js'
import { createDoorKeypadController } from './door-keypad.js'
import { DOOR_COLLISION_RADIUS, crossedDoorThreshold, resolveBarBoundaryMove } from './door-collision.js'
import { createGlassProp } from './glass-prop.js'
import { NOTE_LAYOUT } from './glass-visual.js'
import {
  addHorrorScreenLights,
  addHorrorTvPile,
  HORROR_TV_MODEL_URL,
  updateHorrorEntranceDoor,
} from './horror-room.js'
import { createSceneLifecycle } from './scene-lifecycle.js'
import { createTvProp } from './tv-prop.js'
import {
  isCandidateEligible,
  isShortClick,
  selectClickTarget,
} from './click-interactions.js'
import { getInitialScene } from './app-route.js'

const host = document.querySelector('.bar-scene')
const status = document.querySelector('.bar-scene__status')
const hint = document.querySelector('.bar-scene__hint')
const interactionPrompt = document.querySelector('.bar-scene__interaction')
const dialDialog = document.querySelector('.bar-scene__dial')
const dialWheel = document.querySelector('.bar-scene__dial-wheel')
const dialNumber = document.querySelector('.bar-scene__dial-number')
const dialSlots = [...document.querySelectorAll('.bar-scene__slots span')]
const doorKeypadDialog = document.querySelector('.bar-scene__door-keypad')
const directHorror = getInitialScene(location.pathname) === 'horror'
const touchMode = matchMedia('(pointer: coarse)').matches
const maxDpr = touchMode ? 1.25 : 1.5

if (touchMode) hint.textContent = '点击物品互动 · 拖动转头 · 点击地面移动'

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
const ambientLight = new THREE.HemisphereLight(0x304d73, 0x160a04, .34)
scene.add(ambientLight)
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
const webLights = webLightRig.map(addAreaLight)

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
const MAX_INTERACTION_DISTANCE = 1.75
const playerRadius = DOOR_COLLISION_RADIUS
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
let occlusionObjects = []
let interactionHitObjects = []
let pointerGesture = null
let pointerPosition = null
let shadowFramesRemaining = 2
let gameState = createGameState()
let interactionTarget = null
let seatedAt = null
let standingReturn = null
let cameraTransition = null
let dialMode = false
let keypadMode = false
let dialAngle = 0
let dialDigit = 0
let dialDragX = null
let safeDoor = null
let safeDial = null
let safeNote = null
let safeDoorBaseY = 0
let safeDialBaseZ = 0
let standingPitch = pitch
let glassProp = null
let noteHandModel = null
let revealedNoteHandModel = null
let doorCardHintModel = null
let tvProp = null
let barRoot = null
let exitDoorPivot = null
let exitDoorBaseY = 0
let doorCardAnchor = null
let doorCardHintAnchor = null
let doorStatusLight = null
let doorPassable = false
let horrorMode = false
let horrorStatic = null
let horrorStaticElapsed = 0
let horrorDoorPivot = null
let sceneLifecycle = null
camera.position.copy(startPosition)

function applyLook() {
  camera.rotation.order = 'YXZ'
  camera.rotation.y = yaw
  camera.rotation.x = pitch
}

function clampPosition(position) {
  if (horrorMode) {
    position.x = THREE.MathUtils.clamp(position.x, -3.78, 3.78)
    position.z = THREE.MathUtils.clamp(position.z, -4.78, 4.72)
  } else {
    position.x = THREE.MathUtils.clamp(position.x, roomBounds.minX, roomBounds.maxX)
    position.z = Math.min(position.z, roomBounds.maxZ)
    const resolved = resolveBarBoundaryMove(camera.position, position, doorPassable)
    position.x = resolved.x
    position.z = resolved.z
  }
  position.y = EYE_HEIGHT
  return position
}

function hitsCounter(position) {
  if (horrorMode) return false
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
  if (!horrorMode && crossedDoorThreshold(camera.position)) enterHorrorRoom()
}

function lookBy(deltaYaw, deltaPitch) {
  if (dialMode || keypadMode) return
  yaw += deltaYaw
  pitch = THREE.MathUtils.clamp(pitch + deltaPitch, -MAX_PITCH, MAX_PITCH)
  applyLook()
}

const hitProxyMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
})

function registerInteraction(candidate, size, offset = [0, 0, 0]) {
  let proxy = candidate.object.userData.clickProxy
  if (!proxy) {
    const scale = touchMode ? 1.25 : 1
    proxy = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] * scale, size[1] * scale, size[2] * scale),
      hitProxyMaterial,
    )
    proxy.name = `${candidate.object.name}_ClickTarget`
    proxy.position.fromArray(offset)
    proxy.userData.interactionCandidates = []
    candidate.object.add(proxy)
    candidate.object.userData.clickProxy = proxy
    interactionHitObjects.push(proxy)
  }
  proxy.userData.interactionCandidates.push(candidate)
}

function updateMovement(deltaTime) {
  if (seatedAt || dialMode || keypadMode || cameraTransition) return
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

function renderGameState() {
  dialSlots.forEach((slot, index) => {
    slot.textContent = gameState.dialDigits[index] ?? '–'
  })
  dialNumber.textContent = String(dialDigit)
  if (safeNote) safeNote.visible = gameState.safeUnlocked && gameState.note.owner === 'safe'
  syncNoteModel(noteHandModel, gameState.note.text === 'wet')
  syncNoteModel(revealedNoteHandModel, gameState.note.text === 'CIDER')
  syncDoorCardHint()
  glassProp?.sync(gameState)
  if (keypadMode) doorKeypad.render(gameState)
  if (doorStatusLight?.material?.color) {
    const color = gameState.door.keypadSolved ? 0x75b65a :
      gameState.door.feedback === 'error' || gameState.door.roomStatus === 'error' ? 0xd43b2e : 0xb88b3b
    doorStatusLight.material.color.setHex(color)
  }
}

function syncDoorCardHint() {
  if (!doorCardHintModel || !doorCardHintAnchor) return
  if (doorCardHintModel.parent !== doorCardHintAnchor) doorCardHintAnchor.add(doorCardHintModel)
  doorCardHintModel.visible = !gameState.door.cardInserted
  doorCardHintModel.position.set(-.052, .014, .003)
  doorCardHintModel.rotation.set(0, 0, 0)
  doorCardHintModel.scale.setScalar(1.2)
}

function syncNoteModel(model, matchesText) {
  if (!model || !glassProp) return
  const visible = matchesText && ['held', 'placed', 'door'].includes(gameState.note.owner)
  model.visible = visible
  if (!visible) return
  const held = gameState.note.owner === 'held'
  const inserted = gameState.note.owner === 'door'
  const anchor = held ? camera : inserted ? doorCardAnchor : glassProp.noteSlotAnchors[gameState.note.slotId]
  if (!anchor) return
  if (model.parent !== anchor) anchor.add(model)
  model.position.set(held ? -.24 : 0, held ? -.2 : inserted ? 0 : NOTE_LAYOUT.placedOffset, held ? -.48 : inserted ? .004 : 0)
  model.rotation.set(held ? -1.28 : inserted ? 0 : -Math.PI / 2, 0, inserted ? 0 : -.18)
  model.scale.setScalar(held ? 1.35 : inserted ? 1.2 : 1)
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

function setPointerFromEvent(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(
    (clientX - rect.left) / rect.width * 2 - 1,
    -(clientY - rect.top) / rect.height * 2 + 1,
  )
}

function promptFor(candidate) {
  if (!candidate) return ''
  if (candidate.type === 'glass-placed' && gameState.glass.content === 'cider') {
    return '点击拾取显影纸条'
  }
  if (candidate.type === 'glass-placed' && gameState.heldItemId === 'wet-note') {
    return '点击将 wet 纸条放入水中'
  }
  return candidate.prompt
}

function findInteractionTarget(clientX, clientY) {
  if (dialMode || keypadMode || cameraTransition) return null
  if (seatedAt) return { type: 'stand', object: seatedAt, prompt: '点击起身' }
  if (touchMode) setPointerFromEvent(clientX, clientY)
  else pointer.set(0, 0)
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects([...interactionHitObjects, ...occlusionObjects], false)
    .map((hit) => hit.object.userData.interactionCandidates
      ? { distance: hit.distance, candidates: hit.object.userData.interactionCandidates }
      : { distance: hit.distance, blocksInteraction: true })
  return selectClickTarget(hits, gameState, MAX_INTERACTION_DISTANCE)
}

function updateInteractionPrompt(clientX = pointerPosition?.x, clientY = pointerPosition?.y) {
  const desktopActive = !touchMode && document.pointerLockElement === renderer.domElement
  if (desktopActive || (touchMode && clientX !== undefined && clientY !== undefined)) {
    interactionTarget = findInteractionTarget(clientX, clientY)
    const promptX = desktopActive ? host.clientWidth / 2 : clientX
    const promptY = desktopActive ? host.clientHeight / 2 : clientY
    interactionPrompt.style.setProperty('--prompt-x', `${promptX}px`)
    interactionPrompt.style.setProperty('--prompt-y', `${promptY}px`)
  } else {
    interactionTarget = null
  }
  interactionPrompt.textContent = promptFor(interactionTarget)
  interactionPrompt.classList.toggle('is-visible', Boolean(interactionTarget))
  host.classList.toggle('has-click-target', Boolean(interactionTarget))
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
  interactionTarget = { type: 'seat', object: seat, prompt: '点击坐下' }
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

function openKeypad() {
  keypadMode = true
  keys.clear()
  walkTarget = null
  doorKeypad.open(gameState)
}

function closeKeypad() {
  keypadMode = false
  doorKeypad.close()
}

const doorKeypad = createDoorKeypadController({
  root: doorKeypadDialog,
  symbols: DOOR_SYMBOLS,
  onSymbol(state, symbolId) {
    gameState = commitDoorSymbol(state, symbolId)
    renderGameState()
    if (sceneLifecycle?.canOpen(gameState)) setTimeout(closeKeypad, 420)
    return gameState
  },
})

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

function performInteraction(target = interactionTarget) {
  if (dialMode) {
    commitCurrentDigit()
    return
  }
  if (keypadMode) return
  if (!target || !isCandidateEligible(target, gameState)) return
  if (target.type === 'seat') sitDown(target.object)
  if (target.type === 'stand') standUp()
  if (target.type === 'safe') openDial()
  if (target.type === 'note') {
    gameState = collectNote(gameState)
  }
  if (target.type === 'glass-source') gameState = collectIceGlass(gameState)
  if (target.type === 'candle') gameState = meltHeldGlass(gameState)
  if (target.type === 'glass-slot') {
    gameState = placeHeldGlass(gameState, target.slotId)
  }
  if (target.type === 'note-slot') {
    gameState = placeHeldNote(gameState, target.slotId)
  }
  if (target.type === 'note-placed') {
    gameState = pickupPlacedNote(gameState)
  }
  if (target.type === 'glass-placed') {
    if (gameState.glass.content === 'cider') gameState = collectRevealedNote(gameState)
    else if (gameState.heldItemId === 'wet-note') gameState = insertWetNote(gameState)
    else gameState = pickupPlacedGlass(gameState)
  }
  if (target.type === 'tv-screen' && tvProp) tvProp.cycleChannel()
  if (target.type === 'door-card-slot') {
    const nextState = insertCiderCard(gameState)
    if (nextState !== gameState) {
      gameState = nextState
      startHorrorPreload()
    }
  }
  if (target.type === 'door-keypad') {
    if (gameState.door.roomStatus === 'error') startHorrorPreload()
    openKeypad()
  }
  renderGameState()
  updateInteractionPrompt()
}

function updateSafeAnimation(deltaTime) {
  if (!safeDoor || !safeDial) return
  const doorTarget = safeDoorBaseY + (gameState.safeUnlocked ? -1.55 : 0)
  safeDoor.rotation.y = THREE.MathUtils.damp(safeDoor.rotation.y, doorTarget, 5, deltaTime)
  safeDial.rotation.z = THREE.MathUtils.damp(safeDial.rotation.z, safeDialBaseZ + dialAngle, 10, deltaTime)
}

function updateExitDoorAnimation(deltaTime) {
  if (!exitDoorPivot || horrorMode) return
  const shouldOpen = sceneLifecycle?.canOpen(gameState) ?? false
  const target = exitDoorBaseY + (shouldOpen ? -Math.PI / 2 : 0)
  exitDoorPivot.rotation.y = THREE.MathUtils.damp(exitDoorPivot.rotation.y, target, 4.5, deltaTime)
  doorPassable = shouldOpen && Math.abs(exitDoorPivot.rotation.y - target) < .12
}

function createHorrorStaticMaterial() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 96
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  const material = new THREE.MeshStandardMaterial({
    name: 'Shared animated CRT static',
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 3.4,
    roughness: .45,
  })
  return { context, texture, material }
}

function updateHorrorStatic(deltaTime) {
  if (!horrorMode || !horrorStatic) return
  horrorStaticElapsed += deltaTime
  if (horrorStaticElapsed < .075) return
  horrorStaticElapsed = 0
  const { context, texture } = horrorStatic
  const image = context.createImageData(128, 96)
  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.random() > .5 ? 225 : Math.floor(Math.random() * 85)
    image.data[index] = value
    image.data[index + 1] = value
    image.data[index + 2] = value
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)
  texture.needsUpdate = true
}

function prepareHorrorRoom(root) {
  horrorStatic = createHorrorStaticMaterial()
  const replacedMaterials = new Set()
  root.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    if (object.name.startsWith('tvScreenGlass_Glass_0')) object.visible = false
    if (object.name.startsWith('CRTScreen') || object.name.startsWith('TVScreen')) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => replacedMaterials.add(material))
      object.material = horrorStatic.material
    }
  })
  replacedMaterials.forEach((material) => material.dispose())
  addHorrorScreenLights(root)
  root.name = 'HorrorRoom'
  return root
}

function startHorrorPreload() {
  if (gameState.door.roomStatus !== 'ready') {
    gameState = setHorrorRoomStatus(gameState, 'loading')
    renderGameState()
  }
  sceneLifecycle.preload((event) => {
    if (event.total) {
      const progress = Math.round(event.loaded / event.total * 100)
      interactionPrompt.textContent = `门后空间载入中 ${progress}%`
    }
  }).then(() => {
    gameState = setHorrorRoomStatus(gameState, 'ready')
    renderGameState()
    if (gameState.door.keypadSolved) setTimeout(closeKeypad, 420)
  }).catch(() => {
    gameState = setHorrorRoomStatus(gameState, 'error')
    renderGameState()
  })
}

function collectBarRoots() {
  const roots = [
    barRoot,
    ambientLight,
    ...webLights,
    moonShadow,
    moonShadow.target,
    tvProp?.root,
    tvProp?.interactionAnchor,
    glassProp?.handAnchor,
    glassProp?.initialAnchor,
    glassProp?.candleTarget,
    ...Object.values(glassProp?.slotAnchors ?? {}),
    ...Object.values(glassProp?.noteSlotAnchors ?? {}),
    noteHandModel,
    revealedNoteHandModel,
    doorCardHintModel,
  ]
  return [...new Set(roots.filter(Boolean))]
}

function activateHorrorRoom() {
  horrorMode = true
  doorPassable = false
  gameState = { ...gameState, door: { ...gameState.door, entered: true } }
  barRoot = null
  glassProp = null
  tvProp = null
  safeDoor = null
  safeDial = null
  safeNote = null
  noteHandModel = null
  revealedNoteHandModel = null
  doorCardHintModel = null
  exitDoorPivot = null
  doorCardAnchor = null
  doorCardHintAnchor = null
  doorStatusLight = null
  const horrorRoot = sceneLifecycle.getHorrorRoot()
  horrorDoorPivot = horrorRoot.getObjectByName('HorrorEntranceDoorPivot')
  if (horrorDoorPivot) horrorDoorPivot.rotation.y = -Math.PI / 2
  horrorRoot.traverse((object) => {
    if (!object.isMesh) return
    occlusionObjects.push(object)
    if (object.name === 'HorrorFloor') floorTargets.push(object)
  })
  camera.position.set(0, EYE_HEIGHT, 4.45)
  yaw = 0
  pitch = 0
  scene.background.setHex(0x010202)
  host.classList.add('is-loaded', 'is-horror')
  status.textContent = '恐怖房间已载入'
  renderGameState()
  applyLook()
}

function enterHorrorRoom() {
  if (horrorMode || !sceneLifecycle?.canOpen(gameState)) return
  tvProp?.dispose()
  tvProp = null
  sceneLifecycle.setBarRoots(collectBarRoots())
  if (!sceneLifecycle.transition(gameState, {
    clearCollections: [interactionHitObjects, occlusionObjects, floorTargets],
  })) return
  activateHorrorRoom()
}

function resize() {
  const width = host.clientWidth
  const height = host.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const roomLoader = new GLTFLoader()
roomLoader.setMeshoptDecoder(MeshoptDecoder)
sceneLifecycle = createSceneLifecycle({
  scene,
  loadHorrorRoom: async (onProgress) => {
    const [roomGltf, televisionGltf] = await Promise.all([
      roomLoader.loadAsync('/models/horror_room_v001-62e06a81.glb', onProgress),
      roomLoader.loadAsync(HORROR_TV_MODEL_URL),
    ])
    const televisionRoot = televisionGltf.scene.getObjectByName('TVRoot') ?? televisionGltf.scene
    addHorrorTvPile(roomGltf.scene, televisionRoot)
    return prepareHorrorRoom(roomGltf.scene)
  },
})
if (directHorror) {
  sceneLifecycle.setBarRoots([ambientLight, ...webLights, moonShadow, moonShadow.target])
  status.textContent = '正在进入恐怖房间...'
  sceneLifecycle.preload((event) => {
    if (event.total) status.textContent = `正在进入恐怖房间... ${Math.round(event.loaded / event.total * 100)}%`
  }).then(() => {
    if (sceneLifecycle.activate({ clearCollections: [interactionHitObjects, occlusionObjects, floorTargets] })) {
      activateHorrorRoom()
    }
  }).catch(() => {
    status.textContent = '恐怖房间载入失败'
  })
}

if (!directHorror) roomLoader.load('/models/cozy_bar_v008-e4ad253c.glb', (gltf) => {
  barRoot = gltf.scene
  scene.add(barRoot)
  barRoot.traverse((object) => {
    if (object.isPointLight) {
      object.decay = 2
      object.distance = object.name.startsWith('Neon accent') ? 1.15 : 1.7
      object.intensity *= .45
    }
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    occlusionObjects.push(object)
    if (object.name.startsWith('Floor plank')) floorTargets.push(object)
  })
  const seatNames = ['SeatInteract_1', 'SeatInteract_2', 'SeatInteract_3', 'SeatInteract_4']
  seatNames.forEach((name) => registerInteraction({
    type: 'seat',
    object: gltf.scene.getObjectByName(name),
    prompt: '点击坐下',
  }, [.66, .18, .66], [0, -.915, 0]))
  safeDoor = gltf.scene.getObjectByName('SafeDoor')
  safeDial = gltf.scene.getObjectByName('SafeDial')
  safeNote = gltf.scene.getObjectByName('SafeNote')
  exitDoorPivot = gltf.scene.getObjectByName('ExitDoorPivot')
  exitDoorBaseY = exitDoorPivot.rotation.y
  doorCardAnchor = gltf.scene.getObjectByName('DoorCardInserted')
  doorCardHintAnchor = gltf.scene.getObjectByName('DoorCardHint')
  doorStatusLight = gltf.scene.getObjectByName('DoorStatusLight')
  noteHandModel = safeNote.clone(true)
  noteHandModel.name = 'WetNoteHandModel'
  noteHandModel.position.set(-.24, -.2, -.48)
  noteHandModel.rotation.set(-1.28, 0, -.18)
  noteHandModel.scale.multiplyScalar(1.35)
  noteHandModel.visible = false
  camera.add(noteHandModel)
  registerInteraction(
    { type: 'safe', object: gltf.scene.getObjectByName('SafeInteract'), prompt: '点击使用拨盘' },
    [.86, .92, .28],
  )
  registerInteraction({ type: 'note', object: safeNote, prompt: '点击拾取纸条' }, [.38, .06, .24])
  registerInteraction({
    type: 'door-card-slot',
    object: gltf.scene.getObjectByName('DoorCardSlot'),
    prompt: '点击插入 CIDER 卡片',
  }, [.48, .28, .18])
  registerInteraction({
    type: 'door-keypad',
    object: gltf.scene.getObjectByName('DoorKeypadInteract'),
    prompt: '点击使用符号键盘',
  }, [.58, .58, .18])
  safeDoorBaseY = safeDoor.rotation.y
  safeDialBaseZ = safeDial.rotation.z
  renderer.shadowMap.autoUpdate = true
  renderer.shadowMap.needsUpdate = true
  shadowFramesRemaining = 2
  host.classList.add('is-loaded')
  status.textContent = '场景已载入'
  renderGameState()
}, (event) => {
  if (event.total) status.textContent = `正在进入酒吧... ${Math.round(event.loaded / event.total * 100)}%`
}, () => {
  status.textContent = '场景载入失败'
})

if (!directHorror) createGlassProp(scene, camera).then((controller) => {
  glassProp = controller
  revealedNoteHandModel = glassProp.createRevealedNoteModel()
  revealedNoteHandModel.name = 'RevealedNoteHandModel'
  revealedNoteHandModel.position.set(-.24, -.2, -.48)
  revealedNoteHandModel.rotation.z = -.18
  revealedNoteHandModel.scale.setScalar(1.35)
  revealedNoteHandModel.visible = false
  camera.add(revealedNoteHandModel)
  doorCardHintModel = glassProp.createCiderLabelModel()
  doorCardHintModel.name = 'DoorCardHintModel'
  doorCardHintModel.visible = false
  registerInteraction(
    { type: 'glass-source', object: glassProp.initialAnchor, prompt: '点击拾取冰酒杯' },
    [.22, .35, .22],
    [0, .155, 0],
  )
  registerInteraction(
    { type: 'candle', object: glassProp.candleTarget, prompt: '点击用烛火融化冰块' },
    [.2, .32, .2],
    [0, -.02, 0],
  )
  Object.entries(glassProp.slotAnchors).forEach(([slotId, object]) => {
    registerInteraction({ type: 'glass-slot', object, slotId, prompt: '点击放下酒杯' }, [.34, .12, .34], [0, .04, 0])
    registerInteraction({ type: 'glass-placed', object, slotId, prompt: '点击拾起酒杯' }, [.34, .34, .34], [0, .16, 0])
  })
  Object.entries(glassProp.noteSlotAnchors).forEach(([slotId, object]) => {
    registerInteraction({ type: 'note-slot', object, slotId, prompt: '点击放下纸条' }, [.3, .08, .22], [0, .03, 0])
    registerInteraction({ type: 'note-placed', object, slotId, prompt: '点击拾起纸条' }, [.3, .08, .22], [0, .03, 0])
  })
  renderGameState()
}).catch(() => {
  status.textContent = '互动道具载入失败'
})

if (!directHorror) createTvProp(scene).then((controller) => {
  if (horrorMode) {
    controller.dispose()
    return
  }
  tvProp = controller
  occlusionObjects.push(...tvProp.occluders)
  const tvInteraction = {
    type: 'tv-screen',
    object: tvProp.interactionAnchor,
    prompt: '点击切换频道',
    get disabled() { return tvProp.isGlitching() },
  }
  registerInteraction(
    tvInteraction,
    [.08, .34, .46],
  )
  renderer.shadowMap.autoUpdate = true
  renderer.shadowMap.needsUpdate = true
  shadowFramesRemaining = 2
}).catch(() => {
  status.textContent = '电视载入失败，谜题仍可继续'
})

addEventListener('keydown', (event) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    keys.add(event.code)
    host.classList.add('has-interacted')
    event.preventDefault()
  }
  if (event.code === 'Escape' && dialMode) closeDial()
  if (event.code === 'Escape' && keypadMode) closeKeypad()
})
addEventListener('keyup', (event) => keys.delete(event.code))

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return
  pointerGesture = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  }
  renderer.domElement.setPointerCapture(event.pointerId)
})
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch') return
  pointerPosition = { x: event.clientX, y: event.clientY }
  if (!pointerGesture) {
    updateInteractionPrompt(event.clientX, event.clientY)
    return
  }
  const dx = event.clientX - pointerGesture.lastX
  const dy = event.clientY - pointerGesture.lastY
  if (!isShortClick(pointerGesture, event, 8)) pointerGesture.moved = true
  if (pointerGesture.moved) {
    host.classList.add('is-dragging')
    lookBy(-dx * .005, -dy * .005)
  }
  pointerGesture.lastX = event.clientX
  pointerGesture.lastY = event.clientY
  host.classList.add('has-interacted')
})
renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch') return
  if (!pointerGesture) return
  const clicked = !pointerGesture.moved && isShortClick(pointerGesture, event, 8)
  pointerGesture = null
  host.classList.remove('is-dragging')
  pointerPosition = { x: event.clientX, y: event.clientY }
  if (clicked && !dialMode && !keypadMode) {
    const target = findInteractionTarget(event.clientX, event.clientY)
    if (target) {
      performInteraction(target)
    } else if (floorTargets.length && !seatedAt && !cameraTransition) {
      setPointerFromEvent(event.clientX, event.clientY)
      raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(floorTargets, false)[0]
    if (hit) {
      const target = clampPosition(new THREE.Vector3(hit.point.x, EYE_HEIGHT, hit.point.z))
      if (!hitsCounter(target)) walkTarget = target
    }
    }
  }
  updateInteractionPrompt(event.clientX, event.clientY)
})
renderer.domElement.addEventListener('pointerleave', () => {
  if (!touchMode) return
  if (!pointerGesture) {
    pointerPosition = null
    updateInteractionPrompt()
  }
})
renderer.domElement.addEventListener('pointercancel', () => {
  if (!touchMode) return
  pointerGesture = null
  host.classList.remove('is-dragging')
})

renderer.domElement.addEventListener('click', () => {
  if (touchMode || dialMode || keypadMode) return
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock()
    return
  }
  performInteraction(findInteractionTarget())
})
document.addEventListener('pointerlockchange', () => {
  host.classList.toggle('is-active', document.pointerLockElement === renderer.domElement)
  updateInteractionPrompt()
})
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement) return
  lookBy(-event.movementX * .002, -event.movementY * .002)
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
document.querySelector('.bar-scene__door-close').addEventListener('click', closeKeypad)
document.querySelector('[data-action="dial-commit"]').addEventListener('click', commitCurrentDigit)

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
  updateExitDoorAnimation(deltaTime)
  if (horrorMode) updateHorrorEntranceDoor(horrorDoorPivot, deltaTime)
  updateHorrorStatic(deltaTime)
  glassProp?.update(deltaTime)
  if (!touchMode) updateInteractionPrompt()
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
    keypadMode,
    horrorMode,
    gameState,
    tvChannel: tvProp?.getChannelIndex() ?? null,
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
    if (horrorMode) return false
    camera.position.copy(startPosition)
    yaw = 0
    pitch = .08
    walkTarget = null
    seatedAt = null
    standingReturn = null
    cameraTransition = null
    gameState = createGameState()
    tvProp?.reset()
    dialMode = false
    keypadMode = false
    dialAngle = 0
    dialDigit = 0
    if (safeNote) safeNote.visible = true
    closeDial()
    closeKeypad()
    renderGameState()
    applyLook()
    return true
  },
  interact: performInteraction,
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
