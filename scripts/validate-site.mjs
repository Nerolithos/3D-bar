import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = await readFile(path.join(root, 'src/main.js'), 'utf8')
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const modelDir = path.join(root, 'public/models')
const models = await readdir(modelDir).catch(() => [])
const packagedModelName = 'cozy_bar_v005-411bbe69.glb'
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
  "event.code === 'KeyE'",
  'interactionPrompt',
  'dialDialog',
  'inventoryDrawer',
  'inventoryPreviewRenderer',
  'createInventoryPreview',
  'pitchArc',
]
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing required feature: ${token}`)
}
if (source.includes("button.textContent = '▤'")) {
  throw new Error('Inventory still uses a character placeholder')
}
if (!html.includes('/src/main.js')) throw new Error('Vite entry point is missing')
for (const token of [
  `/models/${packagedModelName}`,
  'data-action="interact"',
  'data-action="inventory"',
  'bar-scene__dial',
  'bar-scene__inventory',
]) {
  if (!html.includes(token)) throw new Error(`Missing interface feature: ${token}`)
}
if (models.length !== 1 || models[0] !== packagedModelName) {
  throw new Error(`public/models must contain only ${packagedModelName}`)
}
const modelPath = path.join(modelDir, models[0])
if ((await stat(modelPath)).size >= 5_000_000) throw new Error('GLB exceeds 5 MB')
const sourceModel = await readFile(path.resolve(root, '../exports/cozy_bar_v005.glb'))
const packagedModel = await readFile(modelPath)
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
if (digest(sourceModel) !== digest(packagedModel)) throw new Error('Packaged GLB hash mismatch')
console.log('SITE VALIDATION PASSED')
