import * as THREE from 'three'
import {
  createLibraryPuzzleState,
  canUseLibraryControl,
  getLibraryLightRowLevels,
  openLibraryRewardBook,
  pickupLibraryKey,
  recordLibraryBookAction,
  resolveLibraryEscape,
  toggleLibraryPuzzleLights,
  toggleLibraryKeySlot,
  updateLibraryPuzzle,
} from './library-puzzle.js'

export const ELEVATOR_MODEL_URL = '/models/elevator-b6e14779.glb'
export const BOOKSHELF_MODEL_URL = '/models/bookshelf-1651bc85.glb'
export const CEILING_MODEL_URL = '/models/ceiling-ab0e0502.glb'
export const EYE_TEXTURE_URL = '/textures/library-eye-4e4953f6.webp'
export const WOOD_DOOR_MODEL_URL = '/models/wood_door-68fb2c4e.glb'
export const EYE_MODEL_URL = '/models/eye-7bc5b3e3.glb'
export const KEY_MODEL_URL = '/models/key-b07613f7.glb'

const ELEVATOR_BOUNDS = Object.freeze({ minX: -1.08, maxX: 1.08, minZ: 3.25, maxZ: 5.55 })
const LIBRARY_BOUNDS = Object.freeze({ minX: -6.25, maxX: 6.25, minZ: -14.2, maxZ: 5.75 })
const sharedBoxGeometries = new Map()

function sharedBoxGeometry(size) {
  const key = size.join(':')
  let geometry = sharedBoxGeometries.get(key)
  if (!geometry) {
    geometry = new THREE.BoxGeometry(...size)
    geometry.name = `Shared box ${key}`
    sharedBoxGeometries.set(key, geometry)
  }
  return geometry
}

export function resolveElevatorLibraryMove(position, doorsOpen, previousPosition = null) {
  const bounds = doorsOpen ? LIBRARY_BOUNDS : ELEVATOR_BOUNDS
  const resolved = {
    x: THREE.MathUtils.clamp(position.x, bounds.minX, bounds.maxX),
    z: THREE.MathUtils.clamp(position.z, bounds.minZ, bounds.maxZ),
  }
  if (doorsOpen && previousPosition) {
    const previousInsideDepth = previousPosition.z >= ELEVATOR_BOUNDS.minZ &&
      previousPosition.z <= ELEVATOR_BOUNDS.maxZ
    const nextInsideDepth = resolved.z >= ELEVATOR_BOUNDS.minZ && resolved.z <= ELEVATOR_BOUNDS.maxZ
    const previousInsideWidth = Math.abs(previousPosition.x) <= ELEVATOR_BOUNDS.maxX
    if (previousInsideDepth && nextInsideDepth && previousInsideWidth && Math.abs(resolved.x) > ELEVATOR_BOUNDS.maxX) {
      resolved.x = THREE.MathUtils.clamp(resolved.x, ELEVATOR_BOUNDS.minX, ELEVATOR_BOUNDS.maxX)
    }
    if (previousInsideDepth && nextInsideDepth && !previousInsideWidth && Math.abs(resolved.x) < ELEVATOR_BOUNDS.maxX) {
      resolved.x = Math.sign(previousPosition.x || 1) * ELEVATOR_BOUNDS.maxX
    }
  }
  if (doorsOpen && resolved.z > 3.04 && resolved.z < 3.32) {
    if (Math.abs(resolved.x) > .7) {
      const enteredWallSideways = previousPosition && Math.abs(previousPosition.x) <= .7 &&
        previousPosition.z > 3.04 && previousPosition.z < 3.32
      if (enteredWallSideways) resolved.x = THREE.MathUtils.clamp(resolved.x, -.7, .7)
      else resolved.z = (previousPosition?.z ?? resolved.z) < 3.18 ? 3.04 : 3.32
    }
  }
  return resolved
}

function material(name, color, roughness = .72, metalness = 0) {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness })
}

function proceduralTexture(size, pixel) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const offset = (y * size + x) * 4
    const color = pixel(x, y, size)
    data[offset] = color[0]
    data[offset + 1] = color[1]
    data[offset + 2] = color[2]
    data[offset + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createWallpaperMaterial() {
  const map = proceduralTexture(64, (x, y) => {
    const stripe = x % 16 < 2 ? -13 : x % 16 > 12 ? 5 : 0
    const motif = ((x + 7) % 16 - 8) ** 2 + ((y + 3) % 16 - 8) ** 2 < 5 ? 10 : 0
    const grime = Math.sin(x * 1.91 + y * 2.37) * 4
    return [121 + stripe + motif + grime, 92 + stripe + motif + grime, 49 + stripe + grime]
  })
  map.repeat.set(6, 3)
  return new THREE.MeshStandardMaterial({ name: 'Aged wax-yellow wallpaper', map, color: 0xffffff, roughness: .96 })
}

function box(parent, name, size, position, boxMaterial) {
  const mesh = new THREE.Mesh(sharedBoxGeometry(size), boxMaterial)
  mesh.name = name
  mesh.position.fromArray(position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function normalizedClone(source, targetHeight, name, { straightenHorizontal = false } = {}) {
  const group = new THREE.Group()
  group.name = name
  const content = new THREE.Group()
  content.name = `${name} normalized content`
  const clone = source.clone(true)
  content.add(clone)
  group.add(content)
  group.updateMatrixWorld(true)
  if (straightenHorizontal) {
    const frame = clone.getObjectByName('Cylinder005_bookshelf_0') ??
      clone.getObjectByProperty('isMesh', true)
    if (frame) {
      const widthAxis = new THREE.Vector3(1, 0, 0).transformDirection(frame.matrixWorld)
      content.rotation.y = Math.atan2(widthAxis.z, widthAxis.x)
      group.updateMatrixWorld(true)
    }
  }
  const bounds = new THREE.Box3().setFromObject(clone)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = targetHeight / Math.max(size.y, .001)
  content.scale.setScalar(scale)
  content.position.copy(center).multiplyScalar(-scale)
  return group
}

function createShelfUnit(source) {
  return normalizedClone(source, 2.65, 'Library bookshelf unit', { straightenHorizontal: true })
}

function createInstancedShelfUnits(template, placements) {
  const group = new THREE.Group()
  group.name = 'Instanced library bookshelf units'
  group.userData.instanceCount = placements.length
  template.updateMatrixWorld(true)
  const templateInverse = template.matrixWorld.clone().invert()
  const relative = new THREE.Matrix4()
  const placementMatrix = new THREE.Matrix4()
  const combined = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3(1, 1, 1)
  template.traverse((sourceMesh) => {
    if (!sourceMesh.isMesh || !sourceMesh.visible) return
    relative.multiplyMatrices(templateInverse, sourceMesh.matrixWorld)
    const instanced = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, placements.length)
    instanced.name = `Instanced shelf ${sourceMesh.name}`
    instanced.castShadow = sourceMesh.castShadow
    instanced.receiveShadow = sourceMesh.receiveShadow
    for (const [index, placement] of placements.entries()) {
      position.set(placement.x, 1.34, placement.z)
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY)
      placementMatrix.compose(position, quaternion, scale)
      combined.multiplyMatrices(placementMatrix, relative)
      instanced.setMatrixAt(index, combined)
    }
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingBox()
    instanced.computeBoundingSphere()
    group.add(instanced)
  })
  return group
}

function createPullableBook(bookId, coverMaterial, pageMaterial, detailMaterial) {
  const book = new THREE.Group()
  book.name = `Pullable library book ${bookId}`
  book.userData.bookId = bookId
  book.userData.pulled = false
  const width = .11
  const height = .27
  const depth = .34
  box(book, 'Pullable book page block', [width * .72, height * .9, depth * .78], [0, 0, -.01], pageMaterial)
  box(book, 'Pullable book left cover', [.018, height, depth], [-width * .47, 0, 0], coverMaterial)
  box(book, 'Pullable book right cover', [.018, height, depth], [width * .47, 0, 0], coverMaterial)
  box(book, 'Pullable book decorated spine', [width, height, .028], [0, 0, depth * .51], coverMaterial)
  for (const y of [-.085, .085]) {
    box(book, 'Pullable book spine band', [width * .82, .018, .018], [0, y, depth * .575], detailMaterial)
  }
  book.userData.spineOffsetZ = depth * .51
  book.userData.height = height
  book.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
  return book
}

function getShelfBoardTops(frame) {
  if (!frame?.isMesh || !frame.geometry?.getAttribute('position')) return []
  const position = frame.geometry.getAttribute('position')
  const heights = new Set()
  const vertex = new THREE.Vector3()
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index).applyMatrix4(frame.matrixWorld)
    heights.add(Math.round(vertex.y * 10000) / 10000)
  }
  const sorted = [...heights].sort((a, b) => a - b)
  return sorted.filter((height, index) => sorted[index + 1] - height > .16)
}

function removeSourceBookOverlap(sourceBooks, interactiveBook) {
  if (!sourceBooks?.isMesh || !sourceBooks.geometry?.getAttribute('position')) return
  const sourceGeometry = sourceBooks.geometry.index ? sourceBooks.geometry.toNonIndexed() : sourceBooks.geometry.clone()
  const position = sourceGeometry.getAttribute('position')
  const clearance = new THREE.Box3().setFromObject(interactiveBook)
    .expandByVector(new THREE.Vector3(.18, .04, .18))
  const centroid = new THREE.Vector3()
  const vertex = new THREE.Vector3()
  const keptTriangles = []
  for (let triangle = 0; triangle < position.count; triangle += 3) {
    centroid.set(0, 0, 0)
    for (let corner = 0; corner < 3; corner += 1) {
      vertex.fromBufferAttribute(position, triangle + corner).applyMatrix4(sourceBooks.matrixWorld)
      centroid.add(vertex)
    }
    centroid.multiplyScalar(1 / 3)
    if (!clearance.containsPoint(centroid)) keptTriangles.push(triangle)
  }
  if (keptTriangles.length * 3 === position.count) return
  const filtered = new THREE.BufferGeometry()
  for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
    const values = new attribute.array.constructor(keptTriangles.length * 3 * attribute.itemSize)
    let write = 0
    for (const triangle of keptTriangles) for (let corner = 0; corner < 3; corner += 1) {
      const sourceOffset = (triangle + corner) * attribute.itemSize
      for (let component = 0; component < attribute.itemSize; component += 1) {
        values[write++] = attribute.array[sourceOffset + component]
      }
    }
    filtered.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized))
  }
  filtered.computeBoundingBox()
  filtered.computeBoundingSphere()
  sourceBooks.geometry = filtered
  sourceBooks.name = `${sourceBooks.name} with interactive book clearance`
}

function createFantasyDoorBook(doorSource, coverMaterial, pageMaterial, detailMaterial) {
  const root = new THREE.Group()
  root.name = 'Library fantasy door book'
  root.position.set(0, 1.16, -7.3)
  const pages = box(root, 'Fantasy book thick page block', [.84, .15, 1.02], [0, 0, 0], pageMaterial)
  pages.castShadow = true
  box(root, 'Fantasy book lower cover', [.94, .035, 1.12], [0, -.095, 0], coverMaterial)
  box(root, 'Fantasy book left spine', [.07, .21, 1.1], [-.455, -.005, 0], coverMaterial)
  for (const z of [-.46, .46]) {
    box(root, 'Fantasy book gold corner', [.16, .025, .11], [-.35, .1, z], detailMaterial)
    box(root, 'Fantasy book gold corner', [.16, .025, .11], [.35, .1, z], detailMaterial)
  }

  const coverPivot = new THREE.Group()
  coverPivot.name = 'Fantasy door cover left hinge'
  coverPivot.position.set(-.43, .11, 0)
  root.add(coverPivot)
  box(coverPivot, 'Door cover leather backing', [.88, .035, 1.08], [.43, 0, 0], coverMaterial)
  const doorWood = new THREE.MeshStandardMaterial({
    name: 'Fantasy cover carved door wood', color: 0x54220f, roughness: .7, metalness: .04,
  })
  const doorRecess = new THREE.MeshStandardMaterial({
    name: 'Fantasy cover recessed door wood', color: 0x281008, roughness: .83,
  })
  const fallbackDoorSource = new THREE.Group()
  fallbackDoorSource.add(new THREE.Mesh(sharedBoxGeometry([.72, 1, .12]), doorWood))
  const usableDoorSource = doorSource.getObjectByProperty('isMesh', true) ? doorSource : fallbackDoorSource
  const doorModel = normalizedClone(usableDoorSource, .91, 'Compressed wood door cover')
  doorModel.position.set(.43, .045, 0)
  doorModel.rotation.x = Math.PI / 2
  doorModel.scale.x = 1.13
  doorModel.traverse((object) => {
    if (!object.isMesh) return
    object.material = doorWood
    object.castShadow = true
    object.receiveShadow = true
  })
  coverPivot.add(doorModel)

  // A readable miniature door: full frame, recessed panels, hinges and a
  // projecting lever handle remain recognizable even in the dim library.
  for (const x of [.075, .785]) box(coverPivot, 'Door cover raised side frame', [.06, .065, .98], [x, .075, 0], doorWood)
  for (const z of [-.46, .46]) box(coverPivot, 'Door cover raised top bottom frame', [.77, .065, .06], [.43, .075, z], doorWood)
  for (const zCenter of [-.23, .22]) {
    box(coverPivot, 'Door cover recessed panel', [.53, .022, .32], [.43, .075, zCenter], doorRecess)
    for (const x of [.155, .705]) box(coverPivot, 'Door cover panel vertical molding', [.035, .045, .36], [x, .095, zCenter], doorWood)
    for (const z of [zCenter - .18, zCenter + .18]) box(coverPivot, 'Door cover panel horizontal molding', [.585, .045, .035], [.43, .095, z], doorWood)
  }
  for (const z of [-.32, .32]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .15, 10), detailMaterial)
    hinge.name = 'Fantasy door visible brass hinge'
    hinge.position.set(.105, .12, z)
    hinge.rotation.x = Math.PI / 2
    coverPivot.add(hinge)
  }
  const handle = new THREE.Group()
  handle.name = 'Fantasy door unmistakable brass lever handle'
  handle.position.set(.65, .13, .04)
  const escutcheon = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .022, 18), detailMaterial)
  escutcheon.name = 'Fantasy door handle round backplate'
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(.021, .021, .065, 12), detailMaterial)
  spindle.position.y = .038
  const lever = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .12, 4, 8), detailMaterial)
  lever.position.set(-.07, .075, 0)
  lever.rotation.z = Math.PI / 2
  handle.add(escutcheon, spindle, lever)
  coverPivot.add(handle)

  root.visible = false
  root.userData.opened = false
  root.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
  return { root, coverPivot }
}

function createEyeInfection(eyeSource) {
  const fallback = new THREE.Mesh(
    new THREE.SphereGeometry(.5, 12, 8),
    new THREE.MeshPhysicalMaterial({ color: 0xd9c4b8, roughness: .25, clearcoat: .8 }),
  )
  const sourceMesh = eyeSource.getObjectByProperty('isMesh', true) ?? fallback
  eyeSource.updateMatrixWorld(true)
  const geometry = sourceMesh.geometry.clone().applyMatrix4(sourceMesh.matrixWorld)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  const normalization = 1 / Math.max(size.x, size.y, size.z, .001)
  geometry.scale(normalization, normalization, normalization)
  geometry.computeVertexNormals()
  const sourceMaterial = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material
  const eyeMaterial = sourceMaterial.clone()
  eyeMaterial.name = 'Compressed eye.glb shared infection material'

  const placements = []
  const add = (x, y, z, radius, delay) => placements.push({ position: new THREE.Vector3(x, y, z), radius, delay })
  const distanceScaledRadius = (x, z, base = .095) => {
    const distanceFromBook = Math.hypot(x, z + 7.3)
    return base + Math.min(.17, distanceFromBook * .014)
  }
  // Dense three-dimensional mound entirely inside the open page cavity.
  for (let index = 0; index < 52; index += 1) {
    const angle = index * 2.399963
    const radial = .025 + .325 * Math.sqrt(index / 51)
    add(
      Math.cos(angle) * radial,
      1.275 + (1 - radial / .36) * .205 + (index % 4) * .018,
      -7.3 + Math.sin(angle) * radial * 1.18,
      .055 + ((index * 7) % 11) * .01,
      index * .016,
    )
  }
  // The infection advances from the reward table to every table and shelf bank.
  let infectionIndex = 0
  for (const tableZ of [-7.3, -10.7, -3.9]) for (const x of [-1.38, -.92, -.46, 0, .46, .92, 1.38]) {
    const z = tableZ + ((infectionIndex % 3) - 1) * .22
    add(x, 1.14, z, distanceScaledRadius(x, z, .085) + infectionIndex % 3 * .012, 1.6 + infectionIndex++ * .072)
  }
  for (const x of [-5.25, -2.65, 0, 2.65, 5.25]) for (const y of [.55, 1.28, 2.05, 2.72]) {
    const eyeX = x + Math.sin(infectionIndex) * .22
    add(eyeX, y, -14.02, distanceScaledRadius(eyeX, -14.02, .11), 2.4 + infectionIndex++ * .075)
  }
  for (const side of [-1, 1]) for (const z of [-12.1, -9.25, -6.4, -3.55, -.7]) for (const y of [.72, 1.65, 2.55]) {
    const eyeZ = z + Math.cos(infectionIndex) * .2
    add(side * 6.02, y, eyeZ, distanceScaledRadius(side * 6.02, eyeZ, .115), 3.1 + infectionIndex++ * .065)
  }
  const eyes = new THREE.InstancedMesh(geometry, eyeMaterial, placements.length)
  eyes.name = 'Instanced eye.glb spreading infection'
  eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  eyes.castShadow = true
  eyes.receiveShadow = true
  eyes.frustumCulled = false
  eyes.visible = false
  const dummy = new THREE.Object3D()
  const fallbackTarget = new THREE.Vector3(0, 1.7, 0)
  const update = (infectionElapsed, viewerPosition = fallbackTarget) => {
    eyes.visible = infectionElapsed >= 0
    for (const [index, placement] of placements.entries()) {
      const progress = THREE.MathUtils.smoothstep(infectionElapsed, placement.delay, placement.delay + 1.15)
      const pulse = 1 + Math.sin(infectionElapsed * 1.35 + index * .71) * .035
      dummy.position.copy(placement.position)
      dummy.lookAt(viewerPosition)
      dummy.scale.setScalar(placement.radius * progress * pulse)
      dummy.updateMatrix()
      eyes.setMatrixAt(index, dummy.matrix)
    }
    eyes.instanceMatrix.needsUpdate = true
  }
  update(-1)
  return { eyes, placements, update }
}

function normalizedCeilingLight(source) {
  const group = new THREE.Group()
  group.name = 'Compressed ceiling light fixture'
  const clone = source.clone(true)
  group.add(clone)
  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(clone)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = 1.9 / Math.max(size.x, size.z, .001)
  clone.scale.multiplyScalar(scale)
  clone.position.sub(center).multiplyScalar(scale)
  return group
}

function createTableSet(wood, darkWood, bookMaterials, index) {
  const group = new THREE.Group()
  group.name = `Library central table ${index + 1}`
  box(group, 'Wood table top', [3.3, .14, 1.15], [0, 1.02, 0], wood)
  for (const x of [-1.38, 1.38]) for (const z of [-.42, .42]) {
    box(group, 'Wood table leg', [.13, 1, .13], [x, .5, z], darkWood)
  }
  for (const z of [-1.05, 1.05]) {
    box(group, 'Library bench seat', [2.8, .12, .38], [0, .57, z], darkWood)
    for (const x of [-1.15, 1.15]) box(group, 'Library bench leg', [.11, .55, .11], [x, .275, z], darkWood)
  }
  const bookCount = index === 1 ? 3 : 2
  for (let bookIndex = 0; bookIndex < bookCount; bookIndex += 1) {
    const bookX = index === 1 && bookIndex === 2 ? .92 : -.55 + bookIndex * .58
    const book = box(group, 'Book resting on table', [.48, .055, .34],
      [bookX, 1.13, -.12 + (bookIndex % 2) * .24],
      bookMaterials[(index + bookIndex) % bookMaterials.length])
    book.rotation.y = -.18 + bookIndex * .13
  }
  return group
}

function createBrassKey(source, detailMaterial) {
  const key = new THREE.Group()
  key.name = 'Single compressed brass library key'
  const content = source.getObjectByProperty('isMesh', true)
    ? source.clone(true)
    : new THREE.Mesh(sharedBoxGeometry([.34, .055, .025]), detailMaterial)
  key.add(content)
  key.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(content)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = .22 / Math.max(size.x, size.y, size.z, .001)
  content.scale.multiplyScalar(scale)
  content.position.copy(center).multiplyScalar(-scale)
  content.traverse((object) => {
    if (!object.isMesh) return
    object.material = detailMaterial
    object.castShadow = true
    object.receiveShadow = true
  })
  key.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
  return key
}

function createKeySlot(name, position, rotation, detailMaterial) {
  const slot = new THREE.Group()
  slot.name = name
  slot.position.fromArray(position)
  slot.rotation.fromArray(rotation)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.055, .012, 6, 12), detailMaterial)
  rim.name = `${name} brass rim`
  rim.scale.set(.78, .88, 1)
  slot.add(rim)
  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(.022, .022, .018, 8),
    new THREE.MeshBasicMaterial({ name: `${name} dark keyhole`, color: 0x090705 }),
  )
  hole.name = `${name} keyhole`
  hole.rotation.x = Math.PI / 2
  slot.add(hole)
  const slit = box(slot, `${name} dark key slit`, [.017, .05, .014], [0, -.034, .002], hole.material)
  slit.castShadow = false
  slot.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
  return slot
}

export function prepareElevatorLibrary(
  elevatorSource,
  bookshelfSource,
  ceilingSource,
  eyeTexture = null,
  doorSource = new THREE.Group(),
  eyeSource = new THREE.Group(),
  keySource = new THREE.Group(),
  heldKeyAnchor = null,
) {
  const root = new THREE.Group()
  root.name = 'Yog-Sothoth elevator library'
  const wallMaterial = createWallpaperMaterial()
  const floorMaterial = material('Restored dark library floor', 0x171512, .86)
  const ceilingMaterial = material('Shadowed library ceiling', 0x111315, .96)
  const wood = material('Library warm wood', 0x4d2c19, .7)
  const darkWood = material('Library dark wood', 0x25150f, .82)
  const doorMaterial = material('Elevator sliding door metal', 0x8b9296, .28, .78)
  const doorInsetMaterial = material('Elevator door inset metal', 0x555d62, .34, .7)
  const elevatorShellMaterial = material('Elevator interior shell', 0x24282a, .38, .64)
  const bookMaterials = [0x542c2c, 0x28434c, 0x66522c, 0x35452b, 0x3d304f]
    .map((color, index) => material(`Shared library book ${index + 1}`, color, .8))
  const pageMaterial = material('Pullable book warm pages', 0xc8b990, .92)
  const bookDetailMaterial = material('Pullable book aged gold bands', 0x9a783d, .46, .22)

  const elevatorModel = normalizedClone(elevatorSource, 3.25, 'Optimized elevator interior')
  elevatorModel.position.set(0, 1.625, 4.5)
  elevatorModel.traverse((object) => {
    // Object_12 is a monolithic cage mesh that also contains an unanimated
    // front face at the doorway. Keeping it made the collision open while a
    // fake closed door remained visible. The runtime shell below replaces it.
    if (/InteriorDoor|OutsideDoor/i.test(object.name) || object.name === 'Object_12') object.visible = false
  })
  root.add(elevatorModel)
  root.updateMatrixWorld(true)
  const importedHandles = []
  elevatorModel.traverse((object) => {
    if (/^HandleElevator/i.test(object.name)) importedHandles.push(object)
  })
  if (importedHandles.length) {
    const frontHandle = importedHandles
      .map((object) => ({
        object,
        distance: Math.abs(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).z - 3.2),
      }))
      .sort((left, right) => left.distance - right.distance)[0].object
    frontHandle.visible = false
    frontHandle.userData.removedFromFrontDoor = true
  }
  box(root, 'Elevator shell left wall', [.14, 3.2, 2.8], [-1.38, 1.58, 4.53], elevatorShellMaterial)
  box(root, 'Elevator shell right wall', [.14, 3.2, 2.8], [1.38, 1.58, 4.53], elevatorShellMaterial)
  box(root, 'Elevator shell back wall', [2.8, 3.2, .14], [0, 1.58, 5.9], elevatorShellMaterial)
  box(root, 'Elevator shell ceiling', [2.8, .14, 2.8], [0, 3.18, 4.53], elevatorShellMaterial)

  const floor = box(root, 'ElevatorLibraryFloor', [13.4, .18, 20], [0, -.1, -4.3], floorMaterial)
  box(root, 'Library ceiling', [13.4, .16, 17.5], [0, 3.65, -5.65], ceilingMaterial)
  box(root, 'Library back wall', [13.4, 3.8, .22], [0, 1.8, -14.65], wallMaterial)
  box(root, 'Library left wall', [.22, 3.8, 17.5], [-6.65, 1.8, -5.65], wallMaterial)
  box(root, 'Library right wall', [.22, 3.8, 17.5], [6.65, 1.8, -5.65], wallMaterial)
  box(root, 'Library front wall left of elevator', [5.25, 3.8, .22], [-4.025, 1.8, 3.18], wallMaterial)
  box(root, 'Library front wall right of elevator', [5.25, 3.8, .22], [4.025, 1.8, 3.18], wallMaterial)

  box(root, 'Elevator static front left jamb', [.7, 3.05, .18], [-1.05, 1.52, 3.18], elevatorShellMaterial)
  box(root, 'Elevator static front right jamb', [.7, 3.05, .18], [1.05, 1.52, 3.18], elevatorShellMaterial)
  box(root, 'Elevator static front header', [2.8, .35, .18], [0, 2.88, 3.18], elevatorShellMaterial)
  const createDoorLeaf = (name, x, innerEdge) => {
    const leaf = new THREE.Group()
    leaf.name = name
    leaf.position.set(x, 1.43, 3.245)
    box(leaf, `${name} panel`, [.84, 2.7, .11], [0, 0, 0], doorMaterial)
    box(leaf, `${name} recessed face`, [.65, 2.36, .018], [0, 0, .064], doorInsetMaterial)
    box(leaf, `${name} center seam`, [.018, 2.58, .025], [innerEdge * .405, 0, .075], doorInsetMaterial)
    root.add(leaf)
    return leaf
  }
  const leftDoor = createDoorLeaf('Elevator left sliding door', -.42, 1)
  const rightDoor = createDoorLeaf('Elevator right sliding door', .42, -1)

  const modelControlPanel = elevatorModel.getObjectByName('ElevatorInteriorButtons_4') ?? null
  const openButton = new THREE.Object3D()
  const panelKeySlotPosition = new THREE.Vector3(1.105, 1.2, 4.25)
  openButton.name = 'Native elevator panel interaction anchor'
  openButton.userData.ignoreInteractionOcclusion = true
  if (modelControlPanel) {
    root.updateMatrixWorld(true)
    root.attach(modelControlPanel)
    modelControlPanel.name = 'Native elevator control panel on right wall'
    modelControlPanel.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
    )
    root.updateMatrixWorld(true)
    let panelBounds = new THREE.Box3().setFromObject(modelControlPanel)
    const panelCenter = panelBounds.getCenter(new THREE.Vector3())
    modelControlPanel.position.x += 1.305 - panelBounds.max.x
    modelControlPanel.position.y += 1.48 - panelCenter.y
    modelControlPanel.position.z += 4.25 - panelCenter.z
    modelControlPanel.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
    root.updateMatrixWorld(true)
    panelBounds = new THREE.Box3().setFromObject(modelControlPanel)
    const panelSize = panelBounds.getSize(new THREE.Vector3())
    openButton.position.copy(panelBounds.getCenter(new THREE.Vector3()))
    // The panel faces inward from the right wall. Put the ray target just in
    // front of its visible face so the wall can never win the front-on ray.
    openButton.position.x = panelBounds.min.x - .16
    panelKeySlotPosition.set(
      panelBounds.min.x - .025,
      panelBounds.min.y + panelSize.y * .28,
      panelBounds.getCenter(new THREE.Vector3()).z + panelSize.z * .27,
    )
    openButton.userData.interactionSize = new THREE.Vector3(
      .22,
      Math.max(1.22, panelSize.y * 1.28),
      Math.max(.74, panelSize.z * 1.32),
    )
  } else {
    openButton.position.set(1.25, 1.48, 4.25)
    openButton.userData.interactionSize = new THREE.Vector3(.22, 1.22, .74)
  }
  root.add(openButton)

  const shelfTemplate = createShelfUnit(bookshelfSource)
  const pullableBooks = []
  const staticShelfPlacements = []
  const addShelf = (x, z, rotationY, pullable = null) => {
    if (!pullable) {
      staticShelfPlacements.push({ x, z, rotationY })
      return
    }
    const shelf = shelfTemplate.clone(true)
    shelf.position.set(x, 1.34, z)
    shelf.rotation.y = rotationY
    root.add(shelf)
    if (pullable) {
      const book = createPullableBook(
        pullable.id,
        bookMaterials[pullable.materialIndex % bookMaterials.length],
        pageMaterial,
        bookDetailMaterial,
      )
      // The downloaded shelf has a large internal transform, so guessed local
      // coordinates visibly detached these books from the shelves. Anchor each
      // one to the real, transformed book mesh instead.
      root.updateMatrixWorld(true)
      const shelfFrame = shelf.getObjectByName('Cylinder005_bookshelf_0') ??
        shelf.getObjectByProperty('isMesh', true)
      shelfFrame.userData.ignoreInteractionOcclusion = true
      const sourceBooks = shelf.getObjectByName('Object001_books_0') ?? shelf
      const shelfBounds = new THREE.Box3().setFromObject(sourceBooks)
      const shelfSize = shelfBounds.getSize(new THREE.Vector3())
      const spinePoint = shelfBounds.getCenter(new THREE.Vector3())
      const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY)).normalize()
      const lateral = new THREE.Vector3(Math.cos(rotationY), 0, -Math.sin(rotationY)).normalize()
      spinePoint.addScaledVector(lateral, pullable.lateral ?? 0)
      // Each book is hand-assigned to one shelf bay. Its lower edge sits on
      // that bay's board instead of hovering around the bay center.
      const boardTops = getShelfBoardTops(shelfFrame)
      const fallbackBoardY = shelfBounds.min.y + shelfSize.y * (pullable.level / 6)
      const shelfBoardY = boardTops[pullable.level] ?? fallbackBoardY
      spinePoint.y = shelfBoardY + .01 + book.userData.height / 2
      if (Math.abs(forward.x) > .5) spinePoint.x = forward.x > 0 ? shelfBounds.max.x : shelfBounds.min.x
      if (Math.abs(forward.z) > .5) spinePoint.z = forward.z > 0 ? shelfBounds.max.z : shelfBounds.min.z
      // The shelf trim protrudes farther than the original book spines. Seat
      // the interactive spine behind that trim so it reads as a shelved book.
      spinePoint.addScaledVector(forward, -.09)
      book.rotation.y = rotationY
      book.position.copy(spinePoint).addScaledVector(forward, -book.userData.spineOffsetZ)
      book.userData.restPosition = book.position.clone()
      book.userData.pullDirection = forward.clone()
      book.userData.shelfBounds = shelfBounds.clone()
      book.userData.shelfBoardY = shelfBoardY
      root.add(book)
      root.updateMatrixWorld(true)
      removeSourceBookOverlap(sourceBooks, book)
      sourceBooks.userData.ignoreInteractionOcclusion = true
      pullableBooks.push(book)
    }
  }
  for (const x of [-5.25, -2.65, 0, 2.65, 5.25]) {
    const pullable = x === -2.65 ? { id: 'back-amber', level: 3, lateral: .25, materialIndex: 2 } : null
    addShelf(x, -14.32, 0, pullable)
  }
  for (const z of [-12.1, -9.25, -6.4, -3.55, -.7]) {
    const leftPullable = z === -6.4 ? { id: 'left-crimson', level: 2, lateral: -.18, materialIndex: 0 } : null
    const rightPullable = z === -9.25 ? { id: 'right-indigo', level: 4, lateral: .18, materialIndex: 4 } : null
    addShelf(-6.3, z, Math.PI / 2, leftPullable)
    addShelf(6.3, z, -Math.PI / 2, rightPullable)
  }
  const instancedShelves = createInstancedShelfUnits(shelfTemplate, staticShelfPlacements)
  root.add(instancedShelves)
  for (const [index, z] of [-10.7, -7.3, -3.9].entries()) {
    const table = createTableSet(wood, darkWood, bookMaterials, index)
    table.position.z = z
    root.add(table)
  }

  const eyeMaterial = new THREE.SpriteMaterial({
    name: 'Library watching eye glow', map: eyeTexture, color: 0xffffff,
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending,
  })
  if (eyeTexture) eyeTexture.colorSpace = THREE.SRGBColorSpace
  root.updateMatrixWorld(true)
  const bookById = Object.fromEntries(pullableBooks.map((book) => [book.userData.bookId, book]))
  const eyeBookIds = { left: 'left-crimson', right: 'right-indigo', center: 'back-amber' }
  const eyePositions = {}
  for (const [side, bookId] of Object.entries(eyeBookIds)) {
    const book = bookById[bookId]
    const position = book.getWorldPosition(new THREE.Vector3())
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(book.getWorldQuaternion(new THREE.Quaternion()))
    eyePositions[side] = position.addScaledVector(forward, .34)
  }
  const watchingEyes = {}
  for (const [side, position] of Object.entries(eyePositions)) {
    // Each eye needs independent opacity. Sharing one SpriteMaterial meant
    // the last (center) eye overwrote the left/right alpha every frame.
    const eye = new THREE.Sprite(eyeMaterial.clone())
    eye.material.name = `Library watching eye glow ${side}`
    eye.name = `Library watching eye ${side}`
    eye.position.copy(position)
    eye.scale.set(.52, .34, 1)
    eye.visible = false
    root.add(eye)
    watchingEyes[side] = eye
  }
  const eyeGlow = new THREE.PointLight(0xeef5ff, 0, 3.2, 2)
  eyeGlow.name = 'Library watching eye light'
  root.add(eyeGlow)

  const reward = createFantasyDoorBook(doorSource, bookMaterials[1], pageMaterial, bookDetailMaterial)
  root.add(reward.root)
  const eyeInfection = createEyeInfection(eyeSource)
  root.add(eyeInfection.eyes)

  const brassKey = createBrassKey(keySource, bookDetailMaterial)
  root.add(brassKey)
  const keySlots = {
    'elevator-panel': createKeySlot(
      'Elevator panel lower key slot', panelKeySlotPosition.toArray(), [0, Math.PI / 2, 0], bookDetailMaterial,
    ),
    'light-switch': createKeySlot(
      'Library light switch key slot', [1.05, .99, 3.025], [0, 0, 0], bookDetailMaterial,
    ),
    book: createKeySlot('Fantasy book key slot', [.7, .155, .25], [-Math.PI / 2, 0, 0], bookDetailMaterial),
  }
  keySlots['elevator-panel'].scale.setScalar(.65)
  keySlots['elevator-panel'].getObjectByName('Elevator panel lower key slot brass rim').scale.x = .58
  root.add(keySlots['elevator-panel'], keySlots['light-switch'])
  reward.coverPivot.add(keySlots.book)

  const fixtureTemplate = normalizedCeilingLight(ceilingSource)
  const ceilingFixtures = new THREE.Group()
  ceilingFixtures.name = 'Library ceiling light rows'
  const libraryLightRows = []
  for (const [rowIndex, z] of [-2.4, -7, -11.6].entries()) {
    const row = { z, lights: [], diffusers: [] }
    const rowGlow = new THREE.MeshStandardMaterial({
      name: `Library ceiling diffuser glow row ${rowIndex + 1}`,
      color: 0xf6f1df, emissive: 0xfff1ca, emissiveIntensity: 2.2, roughness: .36,
    })
    for (const x of [-2.7, 2.7]) {
      const fixture = fixtureTemplate.clone(true)
      fixture.position.set(x, 3.52, z)
      ceilingFixtures.add(fixture)
      const diffuser = new THREE.Mesh(sharedBoxGeometry([1.48, .025, .18]), rowGlow)
      diffuser.name = `Library ceiling light diffuser row ${rowIndex + 1}`
      diffuser.position.set(x, 3.48, z)
      row.diffusers.push(diffuser)
      ceilingFixtures.add(diffuser)
      const light = new THREE.PointLight(0xffe5b5, 18, 8.8, 2)
      light.name = `Library ceiling pool light row ${rowIndex + 1}`
      light.position.set(x, 3.32, z)
      row.lights.push(light)
      ceilingFixtures.add(light)
    }
    libraryLightRows.push(row)
  }
  root.add(ceilingFixtures)

  const switchPlateMaterial = new THREE.MeshStandardMaterial({
    name: 'White library light switch plate', color: 0xe8e8e2, roughness: .45,
    emissive: 0xdde7e8, emissiveIntensity: .1,
  })
  const switchLeverMaterial = new THREE.MeshStandardMaterial({
    name: 'White library light switch lever', color: 0xfafaf5, roughness: .32,
    emissive: 0xf1ffff, emissiveIntensity: .16,
  })
  const lightSwitch = new THREE.Group()
  lightSwitch.name = 'Library wall light switch'
  lightSwitch.position.set(1.05, 1.35, 3.045)
  box(lightSwitch, 'Library switch white plate', [.28, .42, .055], [0, 0, 0], switchPlateMaterial)
  const switchLever = box(lightSwitch, 'Library switch white flick', [.1, .2, .075], [0, .035, -.045], switchLeverMaterial)
  lightSwitch.traverse((object) => { object.userData.ignoreInteractionOcclusion = true })
  root.add(lightSwitch)
  const switchLocatorLight = new THREE.PointLight(0xe9fbff, .24, 1.05, 2)
  switchLocatorLight.name = 'Library switch locator glow'
  switchLocatorLight.position.set(1.05, 1.35, 2.91)
  root.add(switchLocatorLight)

  const coldAmbient = new THREE.HemisphereLight(0x8f9da6, 0x15110e, 1.42)
  coldAmbient.name = 'Elevator library cold ambience'
  const elevatorLight = new THREE.PointLight(0xd7e4e9, 19, 6.2, 2)
  elevatorLight.name = 'Unstable elevator ceiling light'
  elevatorLight.position.set(0, 2.82, 4.45)
  root.add(coldAmbient, elevatorLight)

  const spawn = new THREE.Object3D()
  spawn.name = 'Elevator spawn'
  spawn.position.set(0, 1.62, 4.75)
  root.add(spawn)

  let doorProgress = 0
  let doorTarget = 0
  let doorsMoving = false
  let libraryLightsOn = true
  let puzzleState = createLibraryPuzzleState()
  let elapsed = 0
  const bookMotionTarget = new THREE.Vector3()
  let infectionElapsed = 0
  let exitRequestPending = false
  let exitRequestConsumed = false
  const leftClosedX = leftDoor.position.x
  const rightClosedX = rightDoor.position.x
  const keyAxis = new THREE.Vector3(1, 0, 0)
  const keySlotOutward = {
    'elevator-panel': new THREE.Vector3(-1, 0, 0),
    'light-switch': new THREE.Vector3(0, 0, -1),
    book: new THREE.Vector3(0, 1, 0),
  }
  const syncKeyVisual = () => {
    const owner = puzzleState.keyOwner
    const targetParent = owner === 'held'
      ? heldKeyAnchor
      : owner === 'book' ? reward.coverPivot : root
    if (targetParent && brassKey.parent !== targetParent) targetParent.add(brassKey)
    brassKey.visible = owner !== 'held' || Boolean(heldKeyAnchor)
    brassKey.scale.setScalar(1)
    brassKey.rotation.set(0, 0, 0)
    if (owner === 'held') {
      brassKey.position.set(0, 0, 0)
      brassKey.rotation.set(.12, -.18, -.18)
      brassKey.scale.setScalar(1)
    } else if (owner === 'floor') {
      brassKey.position.set(.42, .055, 4.62)
      brassKey.rotation.set(-Math.PI / 2, -.35, .08)
    } else if (keySlotOutward[owner]) {
      const outward = keySlotOutward[owner]
      // The key's teeth are on its negative local X end. Push that end deeper
      // into the surface while keeping the bow upright without a twist.
      brassKey.position.copy(keySlots[owner].position).addScaledVector(outward, .06)
      brassKey.quaternion.setFromUnitVectors(keyAxis, outward)
    }
  }
  const applyPuzzleVisuals = () => {
    libraryLightsOn = puzzleState.lightsOn
    const rowLevels = getLibraryLightRowLevels(puzzleState)
    const averageLevel = rowLevels.reduce((sum, level) => sum + level, 0) / rowLevels.length
    coldAmbient.color.setHex(0x8f9da6)
    coldAmbient.groundColor.setHex(0x15110e)
    coldAmbient.intensity = puzzleState.phase === 'blackout' ? .12 + averageLevel * .34 : averageLevel * 1.42
    for (const [rowIndex, row] of libraryLightRows.entries()) {
      const level = rowLevels[rowIndex]
      for (const diffuser of row.diffusers) {
        diffuser.material.emissiveIntensity = level * 2.2
        diffuser.material.emissive.setHex(0xfff1ca)
        diffuser.material.color.setHex(level > .05 ? 0xf6f1df : 0x454541)
      }
      for (const light of row.lights) {
        light.color.setHex(0xffe5b5)
        light.intensity = level * 18
      }
    }
    switchLever.position.y = libraryLightsOn ? .035 : -.035
    switchLever.rotation.x = libraryLightsOn ? -.2 : .2
    for (const [side, eye] of Object.entries(watchingEyes)) {
      const visible = puzzleState.eyeVisible && puzzleState.eyeTarget === side
      eye.visible = visible
      eye.material.opacity = visible ? .94 : 0
      if (visible) eyeGlow.position.copy(eye.position)
    }
    eyeGlow.intensity = 0
    reward.root.visible = puzzleState.rewardVisible
    keySlots.book.visible = puzzleState.rewardVisible
    syncKeyVisual()
  }
  applyPuzzleVisuals()
  return {
    root,
    floor,
    spawn,
    openButton,
    modelControlPanel,
    doorLeaves: [leftDoor, rightDoor],
    lightSwitch,
    switchLocatorLight,
    pullableBooks,
    watchingEyes,
    rewardBook: reward.root,
    eyeInfection: eyeInfection.eyes,
    brassKey,
    keySlots,
    get doorsOpen() { return doorProgress >= .985 },
    get doorsClosed() { return doorProgress <= .015 },
    get passageOpen() { return doorProgress >= .85 },
    get doorsOpening() { return doorsMoving && doorTarget === 1 },
    get doorsMoving() { return doorsMoving },
    get controlsLocked() { return puzzleState.phase === 'survived' },
    get libraryLightsOn() { return libraryLightsOn },
    get keyOwner() { return puzzleState.keyOwner },
    getPuzzleState() { return { ...puzzleState } },
    openDoors() {
      if (!canUseLibraryControl(puzzleState, 'elevator-door') || doorsMoving || doorTarget === 1) return false
      doorTarget = 1
      doorsMoving = true
      return true
    },
    toggleDoors() {
      if (puzzleState.phase === 'survived') return null
      if (!canUseLibraryControl(puzzleState, 'elevator-door')) return { locked: true, opening: doorTarget === 1 }
      // A second press reverses an in-progress movement instead of being lost.
      doorTarget = doorTarget === 1 ? 0 : 1
      doorsMoving = true
      return { opening: doorTarget === 1 }
    },
    toggleLibraryLights() {
      if (!canUseLibraryControl(puzzleState, 'library-light')) return { ...puzzleState, locked: true }
      const previousPhase = puzzleState.phase
      puzzleState = toggleLibraryPuzzleLights(puzzleState)
      if (previousPhase === 'idle' && puzzleState.phase === 'eye-sequence') {
        for (const book of pullableBooks) book.userData.pulled = false
      }
      if (previousPhase === 'awaiting-input' && puzzleState.phase === 'eye-sequence') {
        for (const book of pullableBooks) book.userData.pulled = false
      }
      applyPuzzleVisuals()
      return { ...puzzleState }
    },
    pullBook(bookId) {
      const book = pullableBooks.find(({ userData }) => userData.bookId === bookId)
      if (!book) return null
      if (puzzleState.phase === 'awaiting-input') {
        const puzzle = recordLibraryBookAction(puzzleState, bookId)
        puzzleState = puzzle.state
        if (puzzle.reset) {
          for (const candidate of pullableBooks) candidate.userData.pulled = false
          return { bookId, pulled: false, puzzle }
        }
        if (!puzzle.accepted) return { bookId, pulled: book.userData.pulled, puzzle }
        book.userData.pulled = !book.userData.pulled
        return { bookId, pulled: book.userData.pulled, puzzle }
      }
      if (['eye-sequence', 'awaiting-light', 'success-flash', 'blackout', 'blackout-deadline', 'survived', 'failed'].includes(puzzleState.phase)) {
        return { bookId, pulled: book.userData.pulled, blocked: true }
      }
      book.userData.pulled = !book.userData.pulled
      return { bookId, pulled: book.userData.pulled }
    },
    openRewardBook() {
      const next = openLibraryRewardBook(puzzleState)
      if (next === puzzleState) return false
      puzzleState = next
      reward.root.userData.opened = true
      return true
    },
    pickupKey() {
      const next = pickupLibraryKey(puzzleState)
      if (next === puzzleState) return false
      puzzleState = next
      syncKeyVisual()
      return true
    },
    toggleKeySlot(slotId) {
      const next = toggleLibraryKeySlot(puzzleState, slotId)
      if (next === puzzleState) return false
      puzzleState = next
      syncKeyVisual()
      return puzzleState.keyOwner
    },
    canUseControl(controlId) {
      return canUseLibraryControl(puzzleState, controlId)
    },
    consumeExitRequest() {
      if (!exitRequestPending || exitRequestConsumed) return false
      exitRequestPending = false
      exitRequestConsumed = true
      return true
    },
    resolveEscape(survived) {
      const next = resolveLibraryEscape(puzzleState, survived)
      if (next === puzzleState) return false
      puzzleState = next
      applyPuzzleVisuals()
      return true
    },
    isPlayerSafe(position) {
      return Math.abs(position.x) <= ELEVATOR_BOUNDS.maxX &&
        position.z >= ELEVATOR_BOUNDS.minZ && position.z <= ELEVATOR_BOUNDS.maxZ &&
        doorProgress <= .015
    },
    getDangerLevel(position) {
      if (puzzleState.phase !== 'blackout' && puzzleState.phase !== 'blackout-deadline') return 0
      if (position.z >= ELEVATOR_BOUNDS.minZ) return 0
      const rowIndex = position.z < -9.3 ? 2 : position.z < -4.7 ? 1 : 0
      return 1 - getLibraryLightRowLevels(puzzleState)[rowIndex]
    },
    resetLevel() {
      puzzleState = createLibraryPuzzleState()
      doorProgress = 0
      doorTarget = 0
      doorsMoving = false
      leftDoor.position.x = leftClosedX
      rightDoor.position.x = rightClosedX
      for (const book of pullableBooks) {
        book.userData.pulled = false
        book.position.copy(book.userData.restPosition)
      }
      reward.root.userData.opened = false
      reward.coverPivot.rotation.z = 0
      eyeInfection.eyes.visible = false
      eyeInfection.update(-1)
      infectionElapsed = 0
      exitRequestPending = false
      exitRequestConsumed = false
      applyPuzzleVisuals()
    },
    startAtReward() {
      puzzleState = {
        ...createLibraryPuzzleState(),
        phase: 'reward',
        lightsOn: true,
        rewardVisible: true,
        keyOwner: 'elevator-panel',
      }
      doorProgress = 0
      doorTarget = 0
      doorsMoving = false
      leftDoor.position.x = leftClosedX
      rightDoor.position.x = rightClosedX
      reward.root.userData.opened = false
      reward.coverPivot.rotation.z = 0
      eyeInfection.eyes.visible = false
      eyeInfection.update(-1)
      infectionElapsed = 0
      exitRequestPending = false
      exitRequestConsumed = false
      applyPuzzleVisuals()
    },
    update(deltaTime, viewerPosition = null) {
      elapsed += Math.min(deltaTime, .2)
      const nextPuzzleState = updateLibraryPuzzle(puzzleState, deltaTime)
      if (nextPuzzleState !== puzzleState) {
        puzzleState = nextPuzzleState
        applyPuzzleVisuals()
      }
      const irregular = Math.sin(elapsed * 7.3) * Math.sin(elapsed * 13.7)
      const dropout = Math.sin(elapsed * 2.1 + Math.sin(elapsed * 17.0)) > .91 ? .12 : 1
      elevatorLight.color.setHex(0xd7e4e9)
      elevatorLight.intensity = puzzleState.phase === 'reward'
        ? 19
        : puzzleState.lightsOn ? (14 + irregular * 5.2) * dropout : 0
      for (const book of pullableBooks) {
        const target = bookMotionTarget.copy(book.userData.restPosition).addScaledVector(
          book.userData.pullDirection,
          book.userData.pulled ? .13 : 0,
        )
        book.position.x = THREE.MathUtils.damp(book.position.x, target.x, 10, deltaTime)
        book.position.z = THREE.MathUtils.damp(book.position.z, target.z, 10, deltaTime)
      }
      reward.coverPivot.rotation.z = THREE.MathUtils.damp(
        reward.coverPivot.rotation.z,
        puzzleState.rewardOpened ? -Math.PI : 0,
        5,
        deltaTime,
      )
      if (puzzleState.rewardOpened) {
        infectionElapsed += deltaTime
        eyeInfection.update(infectionElapsed, viewerPosition ?? spawn.position)
        if (infectionElapsed >= 11 && !exitRequestConsumed) exitRequestPending = true
      }
      if (!doorsMoving) return
      doorProgress = THREE.MathUtils.damp(doorProgress, doorTarget, 2.8, deltaTime)
      leftDoor.position.x = leftClosedX - doorProgress * .9
      rightDoor.position.x = rightClosedX + doorProgress * .9
      if (Math.abs(doorProgress - doorTarget) <= .005) {
        doorProgress = doorTarget
        doorsMoving = false
      }
    },
  }
}
