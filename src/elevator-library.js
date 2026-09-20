import * as THREE from 'three'
import {
  createLibraryPuzzleState,
  getLibraryLightRowLevels,
  openLibraryRewardBook,
  recordLibraryBookAction,
  resolveLibraryEscape,
  toggleLibraryPuzzleLights,
  updateLibraryPuzzle,
} from './library-puzzle.js'

export const ELEVATOR_MODEL_URL = '/models/elevator-b6e14779.glb'
export const BOOKSHELF_MODEL_URL = '/models/bookshelf-1651bc85.glb'
export const CEILING_MODEL_URL = '/models/ceiling-ab0e0502.glb'
export const EYE_TEXTURE_URL = '/textures/library-eye-4e4953f6.webp'

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

function createDoorBook(wood, pageMaterial, detailMaterial) {
  const root = new THREE.Group()
  root.name = 'Library reward door book'
  root.position.set(0, 1.16, -7.3)
  const pages = box(root, 'Door book page block', [.48, .075, .64], [0, 0, 0], pageMaterial)
  pages.castShadow = true
  box(root, 'Door book lower cover', [.53, .025, .69], [0, -.05, 0], wood)
  const coverPivot = new THREE.Group()
  coverPivot.name = 'Door book opening cover pivot'
  coverPivot.position.set(0, .055, -.345)
  root.add(coverPivot)
  box(coverPivot, 'Door book cover', [.53, .028, .69], [0, 0, .345], wood)
  box(coverPivot, 'Door symbol panel', [.22, .018, .34], [0, .025, .35], detailMaterial)
  box(coverPivot, 'Door symbol left frame', [.025, .022, .39], [-.14, .03, .35], detailMaterial)
  box(coverPivot, 'Door symbol right frame', [.025, .022, .39], [.14, .03, .35], detailMaterial)
  box(coverPivot, 'Door symbol lintel', [.3, .022, .025], [0, .03, .155], detailMaterial)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), pageMaterial)
  knob.name = 'Door symbol knob'
  knob.position.set(.065, .045, .35)
  coverPivot.add(knob)
  root.visible = false
  root.userData.opened = false
  return { root, coverPivot }
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
    const book = box(group, 'Book resting on table', [.48, .055, .34],
      [-.55 + bookIndex * .58, 1.13 + bookIndex * .025, -.12 + (bookIndex % 2) * .24],
      bookMaterials[(index + bookIndex) % bookMaterials.length])
    book.rotation.y = -.18 + bookIndex * .13
  }
  return group
}

export function prepareElevatorLibrary(elevatorSource, bookshelfSource, ceilingSource, eyeTexture = null) {
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
  root.add(createInstancedShelfUnits(shelfTemplate, staticShelfPlacements))
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
    const eye = new THREE.Sprite(eyeMaterial)
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

  const reward = createDoorBook(bookMaterials[1], pageMaterial, bookDetailMaterial)
  root.add(reward.root)

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
  const leftClosedX = leftDoor.position.x
  const rightClosedX = rightDoor.position.x
  const applyPuzzleVisuals = () => {
    libraryLightsOn = puzzleState.lightsOn
    const rowLevels = getLibraryLightRowLevels(puzzleState)
    const averageLevel = rowLevels.reduce((sum, level) => sum + level, 0) / rowLevels.length
    const bloodRed = puzzleState.phase === 'reward'
    coldAmbient.color.setHex(bloodRed ? 0x5d0000 : 0x8f9da6)
    coldAmbient.groundColor.setHex(bloodRed ? 0x120000 : 0x15110e)
    coldAmbient.intensity = puzzleState.phase === 'blackout' ? .12 + averageLevel * .34 : averageLevel * (bloodRed ? .82 : 1.42)
    for (const [rowIndex, row] of libraryLightRows.entries()) {
      const level = rowLevels[rowIndex]
      for (const diffuser of row.diffusers) {
        diffuser.material.emissiveIntensity = level * 2.2
        diffuser.material.emissive.setHex(bloodRed ? 0xff0000 : 0xfff1ca)
        diffuser.material.color.setHex(level > .05 ? (bloodRed ? 0xc20a05 : 0xf6f1df) : 0x454541)
      }
      for (const light of row.lights) {
        light.color.setHex(bloodRed ? 0xff0800 : 0xffe5b5)
        light.intensity = level * (bloodRed ? 21 : 18)
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
  }
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
    get doorsOpen() { return doorProgress >= .985 },
    get doorsClosed() { return doorProgress <= .015 },
    get passageOpen() { return doorProgress >= .85 },
    get doorsOpening() { return doorsMoving && doorTarget === 1 },
    get doorsMoving() { return doorsMoving },
    get controlsLocked() { return puzzleState.phase === 'survived' },
    get libraryLightsOn() { return libraryLightsOn },
    getPuzzleState() { return { ...puzzleState } },
    openDoors() {
      if (doorsMoving || doorTarget === 1) return false
      doorTarget = 1
      doorsMoving = true
      return true
    },
    toggleDoors() {
      if (puzzleState.phase === 'survived') return null
      // A second press reverses an in-progress movement instead of being lost.
      doorTarget = doorTarget === 1 ? 0 : 1
      doorsMoving = true
      return { opening: doorTarget === 1 }
    },
    toggleLibraryLights() {
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
      reward.coverPivot.rotation.x = 0
      applyPuzzleVisuals()
    },
    update(deltaTime) {
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
      reward.coverPivot.rotation.x = THREE.MathUtils.damp(
        reward.coverPivot.rotation.x,
        puzzleState.rewardOpened ? -2.55 : 0,
        5,
        deltaTime,
      )
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
