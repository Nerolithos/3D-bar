import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = await readFile(path.join(root, 'src/main.js'), 'utf8')
const glassSource = await readFile(path.join(root, 'src/glass-prop.js'), 'utf8').catch(() => '')
const tvSource = await readFile(path.join(root, 'src/tv-prop.js'), 'utf8').catch(() => '')
const visualSource = await readFile(path.join(root, 'src/glass-visual.js'), 'utf8')
const gameSource = await readFile(path.join(root, 'src/game-state.js'), 'utf8')
const keypadSource = await readFile(path.join(root, 'src/door-keypad.js'), 'utf8')
const collisionSource = await readFile(path.join(root, 'src/door-collision.js'), 'utf8')
const lifecycleSource = await readFile(path.join(root, 'src/scene-lifecycle.js'), 'utf8')
const horrorSource = await readFile(path.join(root, 'src/horror-room.js'), 'utf8')
const poolSource = await readFile(path.join(root, 'src/pool-room.js'), 'utf8')
const poolElectricalSource = await readFile(path.join(root, 'src/pool-electrical.js'), 'utf8')
const elevatorLibrarySource = await readFile(path.join(root, 'src/elevator-library.js'), 'utf8')
const libraryPuzzleSource = await readFile(path.join(root, 'src/library-puzzle.js'), 'utf8')
const portalSource = await readFile(path.join(root, 'src/portal-state.js'), 'utf8')
const routeSource = await readFile(path.join(root, 'src/app-route.js'), 'utf8')
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const headers = await readFile(path.join(root, 'public/_headers'), 'utf8')
const modelDir = path.join(root, 'public/models')
const models = await readdir(modelDir).catch(() => [])
const packagedModelName = 'cozy_bar_v008-e4ad253c.glb'
const horrorModelName = 'horror_room_v001-62e06a81.glb'
const poolModelName = 'pool_room_v001-2ee22a73.glb'
const poolPreviewName = 'pool-portal-dagon-deac052c.jpg'
const elevatorModelName = 'elevator-b6e14779.glb'
const bookshelfModelName = 'bookshelf-1651bc85.glb'
const ceilingModelName = 'ceiling-ab0e0502.glb'
const libraryEyeName = 'library-eye-4e4953f6.webp'
const libraryPreviewName = 'portal-yog-sothoth-78d62693.jpg'
const handprintName = 'tv-handprint-b6082550.jpg'
const interactiveModelNames = [
  'ice_cubes-2b87f6f4.glb',
  'tv-9d401ae2.glb',
  'wine_glass-70854faa.glb',
]
const required = [
  "from 'three'",
  "GLTFLoader",
  "RectAreaLightUniformsLib",
  "name: 'moonlight'",
  "name: 'ceilingWarmth'",
  "name: 'shelfGlow'",
  "name: 'neonWash'",
  "name: 'counterPool'",
  'toneMappingExposure = .42',
  'const movementSpeed = 2.8',
  "powerPreference: 'high-performance'",
  'touchMode ? 1.25 : 1.5',
  'shadowMap.autoUpdate = false',
  "document.visibilityState === 'hidden'",
  'getPerformance',
  'MAX_PITCH',
  'counterBounds',
  "from './game-state.js'",
  'const EYE_HEIGHT = 1.75',
  "'SeatInteract_1'",
  "'SeatInteract_4'",
  "'SafeDoor'",
  "'SafeDial'",
  "'SafeNote'",
  "'SafeInteract'",
  'interactionPrompt',
  'dialDialog',
  'pitchArc',
  "from './glass-prop.js'",
  "from './tv-prop.js'",
  'collectIceGlass',
  'meltHeldGlass',
  'placeHeldGlass',
  'pickupPlacedGlass',
  'insertWetNote',
  'placeHeldNote',
  'pickupPlacedNote',
  'document.exitPointerLock()',
  'renderer.domElement.requestPointerLock()',
  "document.pointerLockElement === renderer.domElement",
  'pointer.set(0, 0)',
  "event.pointerType !== 'touch'",
  "from './click-interactions.js'",
  'isShortClick',
  'selectClickTarget',
  'raycaster.setFromCamera(pointer, camera)',
  'event.clientX',
  'event.clientY',
  "type: 'tv-screen'",
  "prompt: '点击切换频道'",
  'tvProp.cycleChannel()',
  "type: 'door-card-slot'",
  "type: 'door-keypad'",
  'startHorrorPreload()',
  'crossedDoorThreshold(camera.position)',
  'sceneLifecycle.transition',
  'updateExitDoorAnimation',
  'updateHorrorStatic',
  'addHorrorScreenLights(root)',
  'sceneLifecycle.activate',
  'if (!directHorror) roomLoader.load',
  'updateHorrorEntranceDoor(horrorDoorPivot, deltaTime)',
  "type: 'portal-screen'",
  'startPortalPreload(target.portalId)',
  'enterTelevisionPortal(target.portalId)',
  'portalLifecycle.transition',
  'poolController.update(deltaTime, { onFloat: poolOnFloat })',
  "type: 'pool-tv-power'",
  "type: 'pool-float'",
  "type: 'elevator-open'",
  "type: 'library-light-switch'",
  "type: 'library-book'",
  "type: 'library-reward-book'",
  'triggerPoolDeath()',
  'returnFromPool({ escaped: true })',
  'preserveCurrent: !config.oneWay',
  'Second portal environmental glow',
  'secondPortalScreenTarget',
  '0xcfe8e5',
  'createTelevisionTransition({ host })',
  'televisionTransition.run(() =>',
  'isPoolInteractionOccluder(object)',
]
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing required feature: ${token}`)
}
if (!routeSource.includes("pathname === '/hr2'") || !source.includes('getInitialScene(location.pathname)')) {
  throw new Error('Missing /hr2 direct horror-room route')
}
if (!routeSource.includes("pathname === '/hr3'") || !source.includes("initialScene === 'horror-after-pool'")) {
  throw new Error('Missing /hr3 completed-pool horror-room route')
}
for (const token of [
  'inventory',
  'KeyE',
  'KeyF',
  'toggleInventory',
  'equipItem',
  "prompt: 'F ",
]) {
  if (source.includes(token) || html.includes(token)) {
    throw new Error(`Removed inventory feature remains: ${token}`)
  }
}
if (!html.includes('/src/main.js')) throw new Error('Vite entry point is missing')
if (!headers.includes("img-src 'self' data: blob:")) {
  throw new Error('CSP img-src must allow embedded GLB blob textures')
}
if (!headers.includes("connect-src 'self' blob:")) {
  throw new Error('CSP connect-src must allow embedded GLB blob textures')
}
if (!headers.includes("script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com")) {
  throw new Error('CSP script-src must allow Meshopt WebAssembly and Cloudflare Insights')
}
if (!headers.includes("connect-src 'self' blob: https://cloudflareinsights.com")) {
  throw new Error('CSP connect-src must allow Cloudflare Insights reporting')
}
for (const token of [
  'bar-scene__dial',
  'data-action="dial-commit"',
  'bar-scene__door-keypad',
]) {
  if (!html.includes(token)) throw new Error(`Missing interface feature: ${token}`)
}
if (!source.includes(`/models/${packagedModelName}`)) throw new Error('Bar model URL is missing from the application source')
if (html.includes(`/models/${packagedModelName}`)) throw new Error('Bar model must not preload on the /hr2 shortcut')
for (const token of ['data-action="interact"', '>F<']) {
  if (html.includes(token)) throw new Error(`Removed F interaction UI remains: ${token}`)
}
if (!html.includes('bar-scene__crosshair')) throw new Error('Center aim cursor is missing')
if (!models.includes(packagedModelName) || !models.includes(horrorModelName) || !models.includes('interactive')) {
  throw new Error('public/models must contain the packaged v008 room, horror room, and interactive assets')
}
const modelPath = path.join(modelDir, packagedModelName)
if ((await stat(modelPath)).size >= 5_000_000) throw new Error('GLB exceeds 5 MB')
const sourceModel = await readFile(path.resolve(root, '../exports/cozy_bar_v008.glb'))
const packagedModel = await readFile(modelPath)
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
if (digest(sourceModel) !== digest(packagedModel)) throw new Error('Packaged GLB hash mismatch')
const horrorModelPath = path.join(modelDir, horrorModelName)
if ((await stat(horrorModelPath)).size >= 2_000_000) throw new Error('Horror room GLB exceeds 2 MB')
const sourceHorrorModel = await readFile(path.resolve(root, '../exports/horror_room_v001.glb'))
const packagedHorrorModel = await readFile(horrorModelPath)
if (digest(sourceHorrorModel) !== digest(packagedHorrorModel)) throw new Error('Packaged horror GLB hash mismatch')
const poolModelPath = path.join(modelDir, poolModelName)
if ((await stat(poolModelPath)).size >= 5_000_000) throw new Error('Pool room GLB exceeds 5 MB')
const sourcePoolModel = await readFile(path.resolve(root, '../exports/pool_room_v001.glb'))
const packagedPoolModel = await readFile(poolModelPath)
if (digest(sourcePoolModel) !== digest(packagedPoolModel)) throw new Error('Packaged pool GLB hash mismatch')
if (poolModelName !== `pool_room_v001-${digest(packagedPoolModel).slice(0, 8)}.glb`) {
  throw new Error('Pool model content hash mismatch')
}
const poolPreview = await readFile(path.join(root, 'public/textures', poolPreviewName))
if (poolPreview.byteLength >= 100_000) throw new Error('Pool portal preview exceeds 100 KB')
if (poolPreviewName !== `pool-portal-dagon-${digest(poolPreview).slice(0, 8)}.jpg`) {
  throw new Error('Pool portal preview content hash mismatch')
}
for (const token of [poolModelName, poolPreviewName, "id: 'pool-01'", "screenName: 'CRTScreen_06'"]) {
  if (!portalSource.includes(token)) throw new Error(`Missing pool portal configuration: ${token}`)
}
for (const [name, limit] of [[elevatorModelName, 500_000], [bookshelfModelName, 100_000], [ceilingModelName, 30_000]]) {
  const bytes = await readFile(path.join(modelDir, name))
  if (bytes.byteLength >= limit) throw new Error(`${name} exceeds optimized size limit`)
  if (!name.includes(digest(bytes).slice(0, 8))) throw new Error(`${name} content hash mismatch`)
}
const libraryPreview = await readFile(path.join(root, 'public/textures', libraryPreviewName))
if (libraryPreview.byteLength >= 100_000) throw new Error('Library portal preview exceeds 100 KB')
if (!libraryPreviewName.includes(digest(libraryPreview).slice(0, 8))) {
  throw new Error('Library portal preview content hash mismatch')
}
const libraryEye = await readFile(path.join(root, 'public/textures', libraryEyeName))
if (libraryEye.byteLength >= 20_000) throw new Error('Library eye texture exceeds 20 KB')
if (!libraryEyeName.includes(digest(libraryEye).slice(0, 8))) throw new Error('Library eye texture content hash mismatch')
for (const token of [elevatorModelName, bookshelfModelName, ceilingModelName, libraryEyeName, libraryPreviewName, "id: 'library-02'", "screenName: 'CRTScreen_07'"]) {
  if (!portalSource.includes(token) && !elevatorLibrarySource.includes(token)) {
    throw new Error(`Missing library portal configuration: ${token}`)
  }
}
for (const token of ['prepareElevatorLibrary', 'Unstable elevator ceiling light', 'Native elevator control panel on right wall', 'straightenHorizontal', 'Library bookshelf unit', 'Instanced library bookshelf units', 'sharedBoxGeometry', 'Book resting on table', 'Library ceiling light rows', 'Library wall light switch', 'Pullable library book', 'Aged wax-yellow wallpaper', 'Restored dark library floor', 'Library front wall left of elevator', 'Library watching eye', 'Library reward door book', 'toggleDoors()']) {
  if (!elevatorLibrarySource.includes(token)) throw new Error(`Missing elevator library feature: ${token}`)
}
for (const token of ["['left', 'right', 'center', 'right', 'left', 'center']", "'success-flash'", "'blackout'", "'blackout-deadline'", 'LIBRARY_BLACKOUT_ROW_SECONDS', 'LIBRARY_SURVIVAL_RESTORE_SECONDS', 'resolveLibraryEscape', 'rewardVisible', 'rewardOpened']) {
  if (!libraryPuzzleSource.includes(token)) throw new Error(`Missing library puzzle feature: ${token}`)
}
for (const token of ['createPoolWaterMaterial', 'createPoolCausticsMaterial', 'windowMask', 'gerstnerWave', 'p.xz +=', 'vWorldNormal', 'lightningArc', 'electricFbm', 'branchPath', 'resolvePoolMove', 'resolveShortestAngle', 'PoolWaterSurface', 'DataTexture', 'Pool Tyndall haze', 'Reflector', 'Clear pool ceiling mirror', 'textureWidth: 384', 'Pool puzzle half-height ladder', 'POOL_DUCKS', 'rotateDuck(duckId)', 'isLadderReady', 'televisionBank', 'ignoreInteractionOcclusion', 'Whole pool television interaction anchor', "'#ff0000'"]) {
  if (!poolSource.includes(token)) throw new Error(`Missing pool room runtime feature: ${token}`)
}
for (const token of ['POOL_COUNTDOWN_SECONDS = 5', 'POOL_DISCHARGE_SECONDS = 3', "phase: 'countdown'", "phase: 'discharge'", "outcome: onFloat ? 'safe' : 'dead'", 'ladderExtension', 'secondTvUnlocked']) {
  if (!poolElectricalSource.includes(token)) throw new Error(`Missing pool electrical puzzle state: ${token}`)
}
for (const token of ["type: 'pool-duck'", "type: 'pool-ladder'", 'poolClimbHeight', 'usePoolLadder', '点击沿梯子爬下去']) {
  if (!source.includes(token)) throw new Error(`Missing pool puzzle interaction: ${token}`)
}
if (/cozy_bar_v00[5-7]/.test(source) || /cozy_bar_v00[5-7]/.test(html)) {
  throw new Error('Application still references a stale room model')
}

for (const token of [
  "const DOOR_CODE = '42425142'",
  'DOOR_SYMBOLS',
  'insertCiderCard',
  'commitDoorSymbol',
  "roomStatus: 'loading'",
]) {
  if (!gameSource.includes(token)) throw new Error(`Missing door state feature: ${token}`)
}
if ((keypadSource.match(/'rune-[^']+'/g) ?? []).length !== 10) {
  throw new Error('Door keypad must expose ten abstract glyphs')
}
for (const token of ['Array.from({ length: 8 }', "root.classList.add('is-error')", 'documentRef.exitPointerLock()']) {
  if (!keypadSource.includes(token)) throw new Error(`Missing keypad feature: ${token}`)
}
for (const token of ['resolveBarBoundaryMove', 'crossedDoorThreshold', 'DOORWAY_MIN_X', 'DOORWAY_MAX_X']) {
  if (!collisionSource.includes(token)) throw new Error(`Missing door collision feature: ${token}`)
}
for (const token of ['loadPromise = null', 'disposeObjectTree', 'material.dispose()', 'scene.remove(root)', 'clearCollections']) {
  if (!lifecycleSource.includes(token)) throw new Error(`Missing lifecycle feature: ${token}`)
}
if (!source.includes('MeshoptDecoder') || !source.includes('setMeshoptDecoder')) {
  throw new Error('Meshopt-compressed room is missing its decoder configuration')
}

const interactiveDir = path.join(modelDir, 'interactive')
const interactiveModels = (await readdir(interactiveDir)).sort()
if (interactiveModels.join() !== interactiveModelNames.join()) {
  throw new Error(`unexpected interactive model set: ${interactiveModels}`)
}
for (const modelName of interactiveModelNames) {
  const model = await readFile(path.join(interactiveDir, modelName))
  if (model.byteLength >= 500_000) throw new Error(`${modelName} exceeds 500 KB`)
  const expectedName = modelName.replace(/-[a-f0-9]{8}\.glb$/, `-${digest(model).slice(0, 8)}.glb`)
  if (modelName !== expectedName) throw new Error(`${modelName} hash mismatch`)
}
for (const token of [
  '/models/interactive/tv-9d401ae2.glb',
  'TVScreen',
  "getObjectByName('tvScreenGlass_Glass_0')",
  'screenGlass.visible = false',
  'TV_CHANNELS',
  '4242 5142',
  'drawHumanPeeler',
  'drawColorBars',
  'drawOptometryScene',
  'context.arc(DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2, 148',
  `/textures/${handprintName}`,
  'TO PEEL HUMANS',
  '666-4514',
  'TV_NORMAL_BRIGHTNESS',
  'TV_ANOMALY_BRIGHTNESS',
  'textureLoader.loadAsync(HANDPRINT_URL)',
  'isGlitching',
  '}, 2000)',
  'rotation.y = Math.PI',
  'root.position.set(3.55, 1.62, 1.62)',
]) {
  if (!tvSource.includes(token)) throw new Error(`Missing TV prop feature: ${token}`)
}
if (tvSource.includes('Path2D')) throw new Error('Procedural TV hand drawing must not remain')
const handprint = await readFile(path.join(root, 'public/textures', handprintName))
if (handprint.byteLength >= 50_000) throw new Error('TV handprint texture exceeds 50 KB')
const expectedHandprintName = `tv-handprint-${digest(handprint).slice(0, 8)}.jpg`
if (handprintName !== expectedHandprintName) throw new Error('TV handprint texture hash mismatch')
if (tvSource.includes('texture.flipY = false')) {
  throw new Error('TV canvas texture must retain vertical flip for the imported screen UVs')
}
for (const token of [
  '/models/interactive/wine_glass-70854faa.glb',
  '/models/interactive/ice_cubes-2b87f6f4.glb',
  'glassAssembly',
  'createPreviewModel',
  'createRevealedNoteModel',
  'createCiderLabelModel',
  "'CIDER'",
  "'counter-1'",
  "'counter-2'",
  "'counter-3'",
  "'cafe-1'",
  "'cafe-2'",
  "'note-counter'",
  "'note-cafe'",
  'initialAnchor.position.set(3.2, 1.55, -.88)',
  'transmission: .12',
  'clearcoat: 1',
  'reflectivity: 1',
  'opacity: .72',
]) {
  if (!glassSource.includes(token)) throw new Error(`Missing glass prop feature: ${token}`)
}
for (const token of ['addHorrorScreenLights', 'new THREE.PointLight', 'horrorRoot.add(light)']) {
  if (!horrorSource.includes(token)) throw new Error(`Missing horror lighting feature: ${token}`)
}
for (const token of [
  'waterCenter: .225',
  'waterHeight: .09',
  'waterBottomRadius: .038',
  'cafeTableTop: .97',
  'placedOffset: .002',
]) {
  if (!visualSource.includes(token)) throw new Error(`Missing visual layout constraint: ${token}`)
}
console.log('SITE VALIDATION PASSED')
