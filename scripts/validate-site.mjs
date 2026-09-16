import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = await readFile(path.join(root, 'src/main.js'), 'utf8')
const glassSource = await readFile(path.join(root, 'src/glass-prop.js'), 'utf8').catch(() => '')
const visualSource = await readFile(path.join(root, 'src/glass-visual.js'), 'utf8')
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const headers = await readFile(path.join(root, 'public/_headers'), 'utf8')
const modelDir = path.join(root, 'public/models')
const models = await readdir(modelDir).catch(() => [])
const packagedModelName = 'cozy_bar_v005-411bbe69.glb'
const interactiveModelNames = [
  'ice_cubes-2b87f6f4.glb',
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
  "event.code === 'KeyF'",
  'interactionPrompt',
  'dialDialog',
  'pitchArc',
  "from './glass-prop.js'",
  'collectIceGlass',
  'meltHeldGlass',
  'placeHeldGlass',
  'pickupPlacedGlass',
  'insertWetNote',
  'placeHeldNote',
  'pickupPlacedNote',
  'document.exitPointerLock()',
]
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing required feature: ${token}`)
}
for (const token of ['inventory', 'KeyE', 'toggleInventory', 'equipItem']) {
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
for (const token of [
  `/models/${packagedModelName}`,
  'data-action="interact"',
  'bar-scene__dial',
]) {
  if (!html.includes(token)) throw new Error(`Missing interface feature: ${token}`)
}
if (models.length !== 2 || !models.includes(packagedModelName) || !models.includes('interactive')) {
  throw new Error('public/models must contain the packaged room and interactive assets')
}
const modelPath = path.join(modelDir, packagedModelName)
if ((await stat(modelPath)).size >= 5_000_000) throw new Error('GLB exceeds 5 MB')
const sourceModel = await readFile(path.resolve(root, '../exports/cozy_bar_v005.glb'))
const packagedModel = await readFile(modelPath)
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
if (digest(sourceModel) !== digest(packagedModel)) throw new Error('Packaged GLB hash mismatch')

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
  '/models/interactive/wine_glass-70854faa.glb',
  '/models/interactive/ice_cubes-2b87f6f4.glb',
  'glassAssembly',
  'createPreviewModel',
  'createRevealedNoteModel',
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
