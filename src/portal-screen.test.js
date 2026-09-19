import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'

import { createPortalScreenController, getPortalScreenVisual } from './portal-screen.js'

test('pool portal screen has distinct loading, ready, error and completed visuals', () => {
  const states = ['loading', 'ready', 'error', 'completed'].map(getPortalScreenVisual)
  assert.equal(new Set(states.map(({ intensity }) => intensity)).size, states.length)
  assert.notEqual(states[1].color, states[2].color)
  assert.equal(states[3].intensity, 0)
})

test('portal artwork fills the CRT face UV island instead of showing its center crop', () => {
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
  const texture = new THREE.Texture()
  createPortalScreenController(screen, texture)
  assert.equal(screen.material.isMeshBasicMaterial, true)
  assert.equal(screen.material.emissive, undefined)
  assert.deepEqual(texture.repeat.toArray(), [4, 4])
  assert.deepEqual(texture.offset.toArray(), [-1.5, -2])
})
