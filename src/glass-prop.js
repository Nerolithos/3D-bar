import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLASS_LAYOUT, NOTE_LAYOUT, getGlassVisualState } from './glass-visual.js'

const GLASS_URL = '/models/interactive/wine_glass-70854faa.glb'
const ICE_URL = '/models/interactive/ice_cubes-2b87f6f4.glb'

const SLOT_POSITIONS = {
  'counter-1': [-1.05, 1.55, -.88],
  'counter-2': [.45, 1.55, -.88],
  'counter-3': [1.95, 1.55, -.88],
  'cafe-1': [-2.92, 1.03, .62],
  'cafe-2': [-2.48, 1.03, .62],
}

const NOTE_SLOT_POSITIONS = {
  'note-counter': [-1.55, 1.55, -.58],
  'note-cafe': [-3.08, NOTE_LAYOUT.cafeAnchorY, .65],
}

function loadModel(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject))
}

function applyMaterial(root, material, renderOrder = 0) {
  root.traverse((object) => {
    if (!object.isMesh) return
    object.material = material
    object.renderOrder = renderOrder
    object.castShadow = true
    object.receiveShadow = true
  })
}

function fitModel(root, targetSize, dimension = 'height') {
  root.updateMatrixWorld(true)
  const initialBounds = new THREE.Box3().setFromObject(root)
  const initialSize = initialBounds.getSize(new THREE.Vector3())
  const divisor = dimension === 'height' ? initialSize.y : Math.max(initialSize.x, initialSize.y, initialSize.z)
  root.scale.setScalar(targetSize / divisor)
  root.updateMatrixWorld(true)
  const fittedBounds = new THREE.Box3().setFromObject(root)
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3())
  root.position.add(new THREE.Vector3(-fittedCenter.x, -fittedBounds.min.y, -fittedCenter.z))
}

function createLetter(letter) {
  const patterns = {
    C: ['111', '100', '100', '100', '111'],
    I: ['111', '010', '010', '010', '111'],
    D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'],
    R: ['110', '101', '110', '101', '101'],
  }
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: 0xf3f7ee,
    depthTest: false,
    side: THREE.DoubleSide,
  })
  patterns[letter].forEach((row, rowIndex) => [...row].forEach((cell, columnIndex) => {
    if (cell !== '1') return
    const pixel = new THREE.Mesh(new THREE.BoxGeometry(.006, .006, .001), material)
    pixel.position.set(columnIndex * .007, -rowIndex * .007, 0)
    pixel.renderOrder = 4
    group.add(pixel)
  }))
  return group
}

function createCiderGeometry() {
  const word = new THREE.Group()
  ;[...'CIDER'].forEach((letter, index) => {
    const glyph = createLetter(letter)
    glyph.position.x = index * .021
    word.add(glyph)
  })
  word.position.set(-.052, .014, .004)
  return word
}

export function createCiderLabelModel() {
  const label = createCiderGeometry()
  label.name = 'CIDER door label'
  return label
}

function createRevealedNoteModel() {
  const note = new THREE.Group()
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(.12, .1, .004),
    new THREE.MeshStandardMaterial({ color: 0xd8c893, roughness: .85 }),
  )
  const cider = createCiderGeometry()
  cider.scale.setScalar(.9)
  note.add(paper, cider)
  return note
}

function cloneVisual(root) {
  const clone = root.clone(true)
  clone.traverse((object) => {
    if (object.isMesh) object.material = object.material.clone()
  })
  return clone
}

export async function createGlassProp(scene, camera) {
  const loader = new GLTFLoader()
  const [glassGltf, iceGltf] = await Promise.all([
    loadModel(loader, GLASS_URL),
    loadModel(loader, ICE_URL),
  ])

  const glassAssembly = new THREE.Group()
  glassAssembly.name = 'glassAssembly'
  const glassModel = glassGltf.scene
  const iceModel = iceGltf.scene
  fitModel(glassModel, .31)
  fitModel(iceModel, GLASS_LAYOUT.iceHeight, 'maximum')
  iceModel.position.y = GLASS_LAYOUT.iceBottom
  const iceBaseScale = iceModel.scale.clone()
  applyMaterial(glassModel, new THREE.MeshPhysicalMaterial({
    color: 0xf7f7f0,
    roughness: .27,
    transmission: .12,
    thickness: .015,
    transparent: true,
    opacity: .72,
    depthWrite: false,
  }), 2)
  applyMaterial(iceModel, new THREE.MeshPhysicalMaterial({
    color: 0xeaf9ff,
    roughness: .08,
    transmission: .24,
    ior: 1.31,
    reflectivity: 1,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: .04,
    emissive: 0x18384d,
    emissiveIntensity: .22,
    transparent: true,
    opacity: .96,
    depthWrite: true,
  }), 3)

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(
      GLASS_LAYOUT.waterTopRadius,
      GLASS_LAYOUT.waterBottomRadius,
      GLASS_LAYOUT.waterHeight,
      24,
    ),
    new THREE.MeshPhysicalMaterial({
      color: 0xb6eaff,
      roughness: .12,
      transmission: .75,
      transparent: true,
      opacity: .58,
      depthWrite: false,
    }),
  )
  water.position.y = GLASS_LAYOUT.waterCenter
  water.renderOrder = 3
  water.visible = false

  const submergedNote = new THREE.Mesh(
    new THREE.BoxGeometry(.1, .115, .004),
    new THREE.MeshStandardMaterial({ color: 0xc8b77f, roughness: .85 }),
  )
  submergedNote.position.y = .235
  submergedNote.rotation.y = -.18
  submergedNote.visible = false
  const ciderWord = createCiderGeometry()
  ciderWord.position.y += submergedNote.position.y
  ciderWord.visible = false
  glassAssembly.add(glassModel, iceModel, water, submergedNote, ciderWord)

  const handAnchor = new THREE.Group()
  handAnchor.name = 'GlassHandAnchor'
  handAnchor.position.set(.29, -.27, -.55)
  handAnchor.rotation.set(-.12, -.28, -.08)
  camera.add(handAnchor)
  if (!camera.parent) scene.add(camera)

  const initialAnchor = new THREE.Group()
  initialAnchor.name = 'IceGlassInteract'
  initialAnchor.position.set(3.2, 1.55, -.88)
  scene.add(initialAnchor)

  const candleTarget = new THREE.Object3D()
  candleTarget.name = 'CafeCandleInteract'
  candleTarget.position.set(-2.7, 1.14, .65)
  scene.add(candleTarget)

  const slotAnchors = Object.fromEntries(Object.entries(SLOT_POSITIONS).map(([slotId, position]) => {
    const anchor = new THREE.Group()
    anchor.name = `GlassSlot_${slotId}`
    anchor.position.fromArray(position)
    scene.add(anchor)
    return [slotId, anchor]
  }))

  const noteSlotAnchors = Object.fromEntries(Object.entries(NOTE_SLOT_POSITIONS).map(([slotId, position]) => {
    const anchor = new THREE.Group()
    anchor.name = `NoteSlot_${slotId}`
    anchor.position.fromArray(position)
    scene.add(anchor)
    return [slotId, anchor]
  }))

  function attachTo(anchor) {
    if (glassAssembly.parent === anchor) return
    anchor.add(glassAssembly)
    glassAssembly.position.set(0, 0, 0)
    glassAssembly.rotation.set(0, 0, 0)
    glassAssembly.scale.setScalar(1)
  }

  function sync(state) {
    const { glass } = state
    glassAssembly.visible = glass.owner !== 'inventory'
    if (glass.owner === 'scene') attachTo(initialAnchor)
    if (glass.owner === 'held') attachTo(handAnchor)
    if (glass.owner === 'placed' && glass.slotId) attachTo(slotAnchors[glass.slotId])

    const visual = getGlassVisualState(glass.content, glass.notePresent)
    iceModel.visible = visual.ice
    iceModel.scale.copy(iceBaseScale)
    water.visible = visual.water
    submergedNote.visible = visual.note
    ciderWord.visible = visual.cider
  }

  function update() {}

  function createPreviewModel(content) {
    const preview = cloneVisual(glassAssembly)
    preview.position.set(0, 0, 0)
    preview.rotation.set(0, 0, 0)
    preview.scale.setScalar(1)
    const previewIce = preview.getObjectByName(iceModel.name) ?? preview.children[1]
    const visual = getGlassVisualState(content, content === 'cider')
    previewIce.visible = visual.ice
    preview.children[2].visible = visual.water
    preview.children[3].visible = visual.note
    preview.children[4].visible = visual.cider
    return preview
  }

  sync({ glass: { owner: 'scene', slotId: null, content: 'ice' } })
  return {
    glassAssembly,
    handAnchor,
    initialAnchor,
    candleTarget,
    slotAnchors,
    noteSlotAnchors,
    sync,
    update,
    createPreviewModel,
    createRevealedNoteModel,
    createCiderLabelModel,
  }
}