import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'

import {
  POOL_COLUMN_RADIUS,
  createPoolCausticsMaterial,
  createPoolWaterMaterial,
  preparePoolRoom,
  resolvePoolMove,
} from './pool-room.js'

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

test('pool ceiling becomes a low-resolution multi-tap blurred mirror', () => {
  const source = preparePoolRoom.toString()
  assert.match(source, /Blurred pool ceiling mirror/)
  assert.match(source, /textureWidth: 256/)
  assert.match(source, /blurredMirrorShader/)
})
