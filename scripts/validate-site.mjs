import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = await readFile(path.join(root, 'src/main.js'), 'utf8')
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const modelDir = path.join(root, 'public/models')
const models = await readdir(modelDir).catch(() => [])
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
]
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing required feature: ${token}`)
}
if (!html.includes('/src/main.js')) throw new Error('Vite entry point is missing')
if (models.length !== 1 || models[0] !== 'cozy_bar_v004.glb') {
  throw new Error('public/models must contain only cozy_bar_v004.glb')
}
const modelPath = path.join(modelDir, models[0])
if ((await stat(modelPath)).size >= 5_000_000) throw new Error('GLB exceeds 5 MB')
const sourceModel = await readFile(path.resolve(root, '../exports/cozy_bar_v004.glb'))
const packagedModel = await readFile(modelPath)
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
if (digest(sourceModel) !== digest(packagedModel)) throw new Error('Packaged GLB hash mismatch')
console.log('SITE VALIDATION PASSED')
