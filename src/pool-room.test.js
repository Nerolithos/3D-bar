import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { POOL_DUCKS } from './pool-puzzle.js'

import {
  POOL_COLUMN_RADIUS,
  createPoolCausticsMaterial,
  createPoolWaterMaterial,
  isPoolInteractionOccluder,
  preparePoolRoom,
  resolveShortestAngle,
  resolvePoolMove,
} from './pool-room.js'

test('ladder camera turns through the shortest angle instead of spinning', () => {
  const current = Math.PI * 6.1
  const resolved = resolveShortestAngle(current, 0)
  assert.ok(Math.abs(resolved - current) < Math.PI)
  assert.ok(Math.abs(Math.sin(resolved)) < 1e-9)
})

test('pool movement stays inside the room and outside the central column', () => {
  assert.deepEqual(resolvePoolMove({ x: 20, z: -20 }), { x: 5.05, z: -7.05 })
  const resolved = resolvePoolMove({ x: 0, z: 0 }, { x: 0, z: -4 })
  assert.ok(Math.hypot(resolved.x, resolved.z) >= POOL_COLUMN_RADIUS)
  const spawn = resolvePoolMove({ x: 0, z: 6.2 })
  assert.deepEqual(spawn, { x: 0, z: 6.2 })
})

test('pool water uses time-driven regular wave shading and updates without rebuilding material', () => {
  const material = createPoolWaterMaterial()
  assert.match(material.vertexShader, /uniform float time/)
  assert.match(material.vertexShader, /gerstnerWave/)
  assert.match(material.vertexShader, /p\.xz \+=/)
  assert.match(material.vertexShader, /vWorldNormal/)
  assert.match(material.fragmentShader, /fresnel/)
  assert.match(material.fragmentShader, /lightningArc/)
  assert.match(material.fragmentShader, /electricFbm/)
  assert.match(material.fragmentShader, /branchPath/)
  assert.doesNotMatch(material.fragmentShader, /electricPulse/)
  const root = new THREE.Group()
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial())
  surface.name = 'PoolWaterSurface'
  root.add(surface)
  const controller = preparePoolRoom(root)
  const assigned = surface.material
  controller.update(.1)
  controller.update(.2)
  assert.strictEqual(surface.material, assigned)
  assert.ok(Math.abs(assigned.uniforms.time.value - .3) < 1e-9)
})

test('water and television meshes never block pool interaction rays', () => {
  const waterByName = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  waterByName.name = 'PoolWaterVolume'
  const waterByMaterial = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  waterByMaterial.material.name = 'Animated pool water'
  const television = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  television.userData.ignoreInteractionOcclusion = true
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  wall.name = 'PoolWallBack'

  assert.equal(isPoolInteractionOccluder(waterByName), false)
  assert.equal(isPoolInteractionOccluder(waterByMaterial), false)
  assert.equal(isPoolInteractionOccluder(television), false)
  assert.equal(isPoolInteractionOccluder(wall), true)
})

test('pool light beams use soft radial haze sprites instead of exported solid shaft meshes', () => {
  assert.match(preparePoolRoom.toString(), /DataTexture/)
  assert.match(preparePoolRoom.toString(), /Sprite/)
  assert.match(preparePoolRoom.toString(), /Pool Tyndall haze/)
})

test('window-localized pool-floor caustics animate procedurally', () => {
  const material = createPoolCausticsMaterial()
  assert.match(material.fragmentShader, /windowMask/)
  assert.match(material.fragmentShader, /uniform float time/)
  assert.equal(material.blending, THREE.AdditiveBlending)
})

test('pool ceiling becomes a clear lightly filtered mirror', () => {
  const source = preparePoolRoom.toString()
  assert.match(source, /Clear pool ceiling mirror/)
  assert.match(source, /textureWidth: 384/)
  assert.match(source, /clearMirrorShader/)
})

test('three-duck alignment reveals a shared-geometry half-height ladder', () => {
  const root = new THREE.Group()
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
  ceiling.name = 'PoolCeiling'
  root.add(ceiling)
  for (const index of [1, 2, 3]) {
    for (const name of [`RubberDuckBody_${index}`, `RubberDuckHead_${index}`, `RubberDuckBeak_${index}`]) {
      const part = new THREE.Mesh(new THREE.SphereGeometry(.1), new THREE.MeshBasicMaterial())
      part.name = name
      root.add(part)
    }
  }
  const controller = preparePoolRoom(root)
  assert.equal(root.getObjectByName('PoolCeiling'), undefined)
  const ladderMeshes = controller.ladder.children.filter((object) => object.isMesh)
  assert.equal(new Set(ladderMeshes.map(({ geometry }) => geometry)).size, 2)
  assert.equal(new Set(ladderMeshes.map(({ material }) => material)).size, 1)
  assert.equal(controller.ladder.visible, false)
  for (const { id, targetStep } of POOL_DUCKS) {
    for (let index = 0; index < targetStep; index += 1) controller.rotateDuck(id)
  }
  assert.equal(controller.getPuzzleState().solved, true)
  assert.equal(controller.ladder.visible, true)
  for (let index = 0; index < 120; index += 1) controller.update(1 / 60)
  assert.equal(controller.isLadderReady(), true)
  const base = controller.getClimbBasePosition(1.65)
  const top = controller.getClimbPosition()
  assert.equal(base.x, top.x)
  assert.equal(base.z, top.z)
  assert.ok(top.y > base.y)
})

test('reused pool television is full-size and leans from the floor onto the rear deck', () => {
  const room = new THREE.Group()
  const source = new THREE.Group()
  source.name = 'TVRoot'
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.5, .7), new THREE.MeshBasicMaterial())
  screen.name = 'TVScreen'
  const dial = new THREE.Object3D()
  dial.name = 'tvDial'
  source.add(screen, dial)

  const controller = preparePoolRoom(room, source)
  const television = controller.electricalTelevision.root
  room.updateMatrixWorld(true)
  const supportedTop = television.localToWorld(new THREE.Vector3(0, .741, 0))

  assert.equal(television.scale.x, 2.2)
  assert.ok(television.position.y <= -1.1)
  assert.ok(supportedTop.y > .2 && supportedTop.y < .5)
  assert.ok(supportedTop.z > 6.4)
  assert.equal(television.getObjectByName('TVScreen').userData.ignoreInteractionOcclusion, true)
  assert.equal(controller.electricalTelevision.interactionAnchor.parent, room)
  assert.ok(controller.electricalTelevision.interactionSize.x > 1)
  assert.ok(controller.electricalTelevision.interactionSize.y > 1)
})
