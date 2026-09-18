import assert from 'node:assert/strict'
import test from 'node:test'

import * as THREE from 'three'

import { HORROR_TV_LAYOUT, addHorrorScreenLights, updateHorrorEntranceDoor } from './horror-room.js'

test('horror room has a dense irregular center pile of the optimized TV', () => {
  assert.ok(HORROR_TV_LAYOUT.length >= 10)
  assert.ok(HORROR_TV_LAYOUT.some(({ rotation }) => Math.abs(rotation[2]) > Math.PI * .75))
  assert.ok(HORROR_TV_LAYOUT.some(({ rotation }) => Math.abs(rotation[0]) > .5))
  assert.ok(new Set(HORROR_TV_LAYOUT.map(({ position }) => position[1])).size >= 3)
  assert.ok(HORROR_TV_LAYOUT.every(({ position }) => Math.abs(position[0]) < 2.2 && Math.abs(position[2]) < 2.2))
})

test('television screens provide bounded diffuse room lighting', () => {
  const room = new THREE.Group()
  for (let index = 0; index < 4; index += 1) {
    const screen = new THREE.Object3D()
    screen.name = `TVScreen_${index}`
    room.add(screen)
  }
  for (let index = 0; index < 13; index += 1) {
    const screen = new THREE.Object3D()
    screen.name = `CRTScreen_${index}`
    room.add(screen)
  }

  room.updateMatrixWorld(true)
  const lights = addHorrorScreenLights(room)

  assert.equal(lights.length, 12)
  assert.ok(lights.every((light) => light.isPointLight && light.parent === room))
  assert.ok(lights.every((light) => light.intensity >= 10 && light.distance >= 4 && light.decay === 2))
  assert.equal(lights.filter((light) => light.userData.screenType === 'TV').length, 4)
  assert.equal(lights.filter((light) => light.userData.screenType === 'CRT').length, 8)
  assert.ok(lights.some((light) => light.userData.screenName === 'CRTScreen_12'))
})

test('horror entrance door closes from its open transition angle', () => {
  const pivot = new THREE.Object3D()
  pivot.rotation.y = -Math.PI / 2

  updateHorrorEntranceDoor(pivot, .2)

  assert.ok(pivot.rotation.y > -Math.PI / 2)
  assert.ok(pivot.rotation.y < 0)
})