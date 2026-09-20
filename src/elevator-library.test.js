import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'

import {
  BOOKSHELF_MODEL_URL,
  CEILING_MODEL_URL,
  ELEVATOR_MODEL_URL,
  prepareElevatorLibrary,
  resolveElevatorLibraryMove,
} from './elevator-library.js'

test('closed elevator confines the player and keeps the camera inside solid side walls', () => {
  assert.deepEqual(resolveElevatorLibraryMove({ x: 5, z: -8 }, false), { x: 1.08, z: 3.25 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: 5, z: -8 }, true), { x: 5, z: -8 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: 2, z: 3.15 }, true, { x: 2, z: 3 }), { x: 2, z: 3.04 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: .75, z: 3.18 }, true, { x: .68, z: 3.18 }), { x: .7, z: 3.18 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: .5, z: 3.15 }, true, { x: .5, z: 3 }), { x: .5, z: 3.15 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: 2, z: 4.5 }, true, { x: 1, z: 4.5 }), { x: 1.08, z: 4.5 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: 0, z: 7 }, true, { x: 0, z: 5.5 }), { x: 0, z: 5.75 })
  assert.deepEqual(resolveElevatorLibraryMove({ x: 1, z: 4.5 }, true, { x: 2, z: 4.5 }), { x: 1.08, z: 4.5 })
})

test('elevator library reuses optimized assets and fills every wall with bookshelves', () => {
  assert.match(ELEVATOR_MODEL_URL, /elevator-[a-f0-9]{8}\.glb$/)
  assert.match(BOOKSHELF_MODEL_URL, /bookshelf-[a-f0-9]{8}\.glb$/)
  assert.match(CEILING_MODEL_URL, /ceiling-[a-f0-9]{8}\.glb$/)
  const elevator = new THREE.Group()
  const duplicateCage = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 2.6), new THREE.MeshBasicMaterial())
  duplicateCage.name = 'Object_12'
  elevator.add(duplicateCage)
  const modelControlPanel = new THREE.Group()
  modelControlPanel.name = 'ElevatorInteriorButtons_4'
  modelControlPanel.position.set(1, 1.3, -1.2)
  modelControlPanel.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .72, .42), new THREE.MeshBasicMaterial()))
  elevator.add(modelControlPanel)
  for (const [index, z] of [-1, 0, 1].entries()) {
    const handle = new THREE.Group()
    handle.name = `HandleElevator${index ? `.${String(index).padStart(3, '0')}` : ''}_${index + 5}`
    const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(.8, .08, .08), new THREE.MeshBasicMaterial())
    handleMesh.position.z = z
    handle.add(handleMesh)
    elevator.add(handle)
  }
  const shelf = new THREE.Group()
  const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.6, .4), new THREE.MeshBasicMaterial())
  const shelfBooks = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, .28), new THREE.MeshBasicMaterial())
  shelfBooks.name = 'Object001_books_0'
  shelf.add(shelfBody, shelfBooks)
  shelf.rotation.y = -.8
  const ceiling = new THREE.Group()
  ceiling.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, .08, .2), new THREE.MeshBasicMaterial()))
  const controller = prepareElevatorLibrary(elevator, shelf, ceiling)
  assert.equal(controller.root.getObjectByName('Object_12').visible, false)
  const panelBounds = new THREE.Box3().setFromObject(controller.modelControlPanel)
  const panelCenter = panelBounds.getCenter(new THREE.Vector3())
  assert.ok(Math.abs(panelBounds.max.x - 1.305) < 1e-6)
  assert.ok(Math.abs(panelCenter.y - 1.48) < 1e-6)
  assert.ok(Math.abs(panelCenter.z - 4.25) < 1e-6)
  assert.ok(controller.openButton.position.x < panelBounds.min.x)
  assert.ok(Math.abs(controller.openButton.position.y - panelCenter.y) < 1e-6)
  assert.ok(Math.abs(controller.openButton.position.z - panelCenter.z) < 1e-6)
  assert.ok(controller.openButton.userData.interactionSize.y >= 1.08)
  assert.ok(controller.openButton.userData.interactionSize.z >= .62)
  assert.equal(controller.root.getObjectByName('Elevator door open close button'), undefined)
  const importedHandles = []
  controller.root.traverse((object) => {
    if (/^HandleElevator/.test(object.name)) importedHandles.push(object)
  })
  assert.equal(importedHandles.filter(({ userData }) => userData.removedFromFrontDoor).length, 1)
  assert.equal(importedHandles.filter(({ visible }) => visible).length, 2)
  controller.openButton.traverse((object) => assert.equal(object.userData.ignoreInteractionOcclusion, true))
  const shelves = controller.root.children.filter(({ name }) => name === 'Library bookshelf unit')
  const tableBooks = []
  controller.root.traverse((object) => { if (object.name === 'Book resting on table') tableBooks.push(object) })
  assert.ok(shelves.length >= 15)
  controller.root.updateMatrixWorld(true)
  const backShelfSize = new THREE.Box3().setFromObject(shelves[0]).getSize(new THREE.Vector3())
  const sideShelfSize = new THREE.Box3().setFromObject(shelves[5]).getSize(new THREE.Vector3())
  assert.ok(backShelfSize.x > backShelfSize.z * 4)
  assert.ok(sideShelfSize.z > sideShelfSize.x * 4)
  assert.ok(tableBooks.length >= 6)
  assert.ok(controller.root.getObjectByName('Library ceiling light rows'))
  assert.ok(controller.root.getObjectByName('Library front wall left of elevator'))
  assert.ok(controller.root.getObjectByName('Library front wall right of elevator'))
  assert.equal(controller.root.getObjectByName('Library shelf generated book'), undefined)
  assert.equal(controller.pullableBooks.length, 3)
  const bookDirections = Object.fromEntries(controller.pullableBooks.map((book) => [book.userData.bookId, book.rotation.y]))
  assert.deepEqual(bookDirections, {
    'back-amber': 0,
    'right-indigo': -Math.PI / 2,
    'left-crimson': Math.PI / 2,
  })
  controller.root.updateMatrixWorld(true)
  const expectedFront = {
    'back-amber': new THREE.Vector3(0, 0, 1),
    'left-crimson': new THREE.Vector3(1, 0, 0),
    'right-indigo': new THREE.Vector3(-1, 0, 0),
  }
  const startPositions = new Map()
  for (const book of controller.pullableBooks) {
    const bookSize = new THREE.Box3().setFromObject(book).getSize(new THREE.Vector3())
    assert.ok(bookSize.y < .32)
    assert.equal(book.parent, controller.root)
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(book.getWorldQuaternion(new THREE.Quaternion()))
    assert.ok(front.dot(expectedFront[book.userData.bookId]) > .999)
    const spine = book.position.clone().addScaledVector(front, book.userData.spineOffsetZ)
    const bounds = book.userData.shelfBounds
    if (Math.abs(front.x) > .5) {
      assert.ok(Math.abs(spine.x - (front.x > 0 ? bounds.max.x - .09 : bounds.min.x + .09)) < 1e-6)
    } else {
      assert.ok(Math.abs(spine.z - (front.z > 0 ? bounds.max.z - .09 : bounds.min.z + .09)) < 1e-6)
    }
    assert.ok(spine.y > bounds.min.y && spine.y < bounds.max.y)
    const bookBounds = new THREE.Box3().setFromObject(book)
    assert.ok(Math.abs(bookBounds.min.y - (book.userData.shelfBoardY + .01)) < 1e-6)
    book.traverse((object) => assert.equal(object.userData.ignoreInteractionOcclusion, true))
    startPositions.set(book.userData.bookId, book.getWorldPosition(new THREE.Vector3()))
    controller.pullBook(book.userData.bookId)
  }
  for (let index = 0; index < 30; index += 1) controller.update(1 / 60)
  controller.root.updateMatrixWorld(true)
  for (const book of controller.pullableBooks) {
    const movement = book.getWorldPosition(new THREE.Vector3()).sub(startPositions.get(book.userData.bookId))
    assert.ok(movement.dot(expectedFront[book.userData.bookId]) > .1)
  }
  const controlPanelStart = controller.modelControlPanel.getWorldPosition(new THREE.Vector3())
  assert.deepEqual(controller.pullBook('back-amber'), { bookId: 'back-amber', pulled: false })
  assert.deepEqual(controller.pullBook('back-amber'), { bookId: 'back-amber', pulled: true })
  assert.equal(controller.libraryLightsOn, true)
  assert.equal(controller.toggleLibraryLights().phase, 'eye-sequence')
  assert.equal(controller.libraryLightsOn, false)
  assert.ok(controller.switchLocatorLight.intensity > 0)
  assert.ok(controller.rewardBook)
  assert.equal(controller.doorsOpen, false)
  const closedDoorXs = controller.doorLeaves.map((door) => door.position.x)
  assert.equal(controller.openDoors(), true)
  for (let index = 0; index < 180; index += 1) controller.update(1 / 60)
  assert.equal(controller.doorsOpen, true)
  assert.equal(controller.isPlayerSafe({ x: 0, z: 4.5 }), false)
  assert.ok(controller.doorLeaves[0].position.x < closedDoorXs[0] - .85)
  assert.ok(controller.doorLeaves[1].position.x > closedDoorXs[1] + .85)
  controller.root.updateMatrixWorld(true)
  assert.ok(controller.modelControlPanel.getWorldPosition(new THREE.Vector3()).distanceTo(controlPanelStart) < 1e-6)
  assert.deepEqual(controller.toggleDoors(), { opening: false })
  for (let index = 0; index < 180; index += 1) controller.update(1 / 60)
  assert.equal(controller.doorsClosed, true)
  assert.equal(controller.isPlayerSafe({ x: 0, z: 4.5 }), true)
  assert.deepEqual(controller.toggleDoors(), { opening: true })
  for (let index = 0; index < 10; index += 1) controller.update(1 / 60)
  assert.deepEqual(controller.toggleDoors(), { opening: false })
  assert.deepEqual(controller.toggleDoors(), { opening: true })
  for (let index = 0; index < 180; index += 1) controller.update(1 / 60)
  assert.equal(controller.doorsOpen, true)
})

test('door control and all three books are ray-clickable without self-occlusion', () => {
  const elevator = new THREE.Group()
  elevator.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 2.6), new THREE.MeshBasicMaterial()))
  const shelf = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.6, .4), new THREE.MeshBasicMaterial())
  frame.name = 'Cylinder005_bookshelf_0'
  const books = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, .28), new THREE.MeshBasicMaterial())
  books.name = 'Object001_books_0'
  shelf.add(frame, books)
  shelf.rotation.y = -.8
  const ceiling = new THREE.Group()
  ceiling.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, .08, .2), new THREE.MeshBasicMaterial()))
  const controller = prepareElevatorLibrary(elevator, shelf, ceiling)
  const occluders = []
  controller.root.traverse((object) => {
    if (object.isMesh && !object.userData.ignoreInteractionOcclusion) occluders.push(object)
  })
  const assertClickable = (object, size, origin) => {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial())
    object.add(proxy)
    controller.root.updateMatrixWorld(true)
    const target = object.getWorldPosition(new THREE.Vector3())
    const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, 4)
    const proxyDistance = ray.intersectObject(proxy, false)[0]?.distance
    const blockerHit = ray.intersectObjects(occluders, true)[0]
    const blockerDistance = blockerHit?.distance ?? Infinity
    assert.ok(Number.isFinite(proxyDistance))
    assert.ok(proxyDistance < blockerDistance,
      `${object.name} proxy ${proxyDistance} must precede ${blockerHit?.object?.name} at ${blockerDistance}`)
    object.remove(proxy)
  }
  controller.root.updateMatrixWorld(true)
  const spawn = controller.spawn.getWorldPosition(new THREE.Vector3())
  const panelFront = new THREE.Vector3(0, 1.48, 4.25)
  assertClickable(controller.openButton, controller.openButton.userData.interactionSize.toArray(), panelFront)
  for (const book of controller.pullableBooks) {
    const center = book.getWorldPosition(new THREE.Vector3())
    const origin = center.clone().addScaledVector(book.userData.pullDirection, 1.2)
    assertClickable(book, [.15, .31, .38], origin)
  }
  assert.deepEqual(controller.toggleDoors(), { opening: true })
  for (let index = 0; index < 180; index += 1) controller.update(1 / 60)
  assert.equal(controller.doorsOpen, true)
  assert.deepEqual(controller.toggleDoors(), { opening: false })
  for (let index = 0; index < 180; index += 1) controller.update(1 / 60)
  assert.equal(controller.doorsClosed, true)
})

test('surviving behind closed doors restores steady elevator light and blood-red library rows', () => {
  const elevator = new THREE.Group()
  elevator.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 2.6), new THREE.MeshBasicMaterial()))
  const shelf = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.6, .4), new THREE.MeshBasicMaterial())
  frame.name = 'Cylinder005_bookshelf_0'
  const books = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, .28), new THREE.MeshBasicMaterial())
  books.name = 'Object001_books_0'
  shelf.add(frame, books)
  const ceiling = new THREE.Group()
  ceiling.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, .08, .2), new THREE.MeshBasicMaterial()))
  const controller = prepareElevatorLibrary(elevator, shelf, ceiling)
  controller.toggleLibraryLights()
  controller.update(1.18 * 6)
  controller.toggleLibraryLights()
  for (const bookId of ['left-crimson', 'right-indigo', 'back-amber', 'right-indigo', 'left-crimson', 'back-amber']) {
    controller.pullBook(bookId)
  }
  controller.update(2.5)
  controller.update(3.8 * 3 + .01)
  assert.equal(controller.getPuzzleState().phase, 'blackout-deadline')
  assert.equal(controller.resolveEscape(true), true)
  assert.equal(controller.controlsLocked, true)
  assert.equal(controller.toggleDoors(), null)
  controller.update(3.01)
  assert.equal(controller.getPuzzleState().phase, 'reward')
  assert.equal(controller.controlsLocked, false)
  const rowLight = controller.root.getObjectByName('Library ceiling pool light row 1')
  const elevatorLight = controller.root.getObjectByName('Unstable elevator ceiling light')
  assert.equal(rowLight.color.getHex(), 0xff0800)
  assert.equal(rowLight.intensity, 21)
  assert.equal(elevatorLight.intensity, 19)
  assert.deepEqual(controller.toggleDoors(), { opening: true })
})
