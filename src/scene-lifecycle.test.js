import assert from 'node:assert/strict'
import test from 'node:test'

import { createSceneLifecycle, disposeObjectTree } from './scene-lifecycle.js'

function disposable() {
  return { calls: 0, dispose() { this.calls += 1 } }
}

test('horror room preload runs once and failed loads remain retryable', async () => {
  const horrorRoot = { visible: true }
  let loads = 0
  const lifecycle = createSceneLifecycle({
    scene: { add() {}, remove() {} },
    loadHorrorRoom: async () => {
      loads += 1
      if (loads === 1) throw new Error('network')
      return horrorRoot
    },
  })

  await assert.rejects(lifecycle.preload(), /network/)
  const first = lifecycle.preload()
  const second = lifecycle.preload()
  assert.strictEqual(first, second)
  assert.strictEqual(await first, horrorRoot)
  assert.equal(loads, 2)
  assert.equal(horrorRoot.visible, false)
})

test('door opens only when keypad and room are ready', async () => {
  const lifecycle = createSceneLifecycle({
    scene: { add() {}, remove() {} },
    loadHorrorRoom: async () => ({ visible: true }),
  })
  await lifecycle.preload()
  assert.equal(lifecycle.canOpen({ door: { keypadSolved: false, roomStatus: 'ready' } }), false)
  assert.equal(lifecycle.canOpen({ door: { keypadSolved: true, roomStatus: 'loading' } }), false)
  assert.equal(lifecycle.canOpen({ door: { keypadSolved: true, roomStatus: 'ready' } }), true)
})

test('recursive disposal releases shared geometry, materials, and textures once', () => {
  const geometry = disposable()
  const texture = disposable()
  texture.isTexture = true
  const material = { ...disposable(), map: texture }
  const root = {
    traverse(visitor) {
      visitor({ geometry, material })
      visitor({ geometry, material: [material] })
    },
  }

  disposeObjectTree(root)
  assert.equal(geometry.calls, 1)
  assert.equal(material.calls, 1)
  assert.equal(texture.calls, 1)
})

test('transition removes and disposes bar roots, clears collections, and activates horror room', async () => {
  const removed = []
  const added = []
  const scene = { remove: (root) => removed.push(root), add: (root) => added.push(root) }
  const geometry = disposable()
  const barRoot = { traverse: (visitor) => visitor({ geometry }) }
  const horrorRoot = { visible: true }
  const interactions = [{}]
  const occluders = [{}]
  const lifecycle = createSceneLifecycle({ scene, loadHorrorRoom: async () => horrorRoot })
  lifecycle.setBarRoots([barRoot])
  await lifecycle.preload()

  const transitioned = lifecycle.transition(
    { door: { keypadSolved: true, roomStatus: 'ready' } },
    { clearCollections: [interactions, occluders] },
  )
  assert.equal(transitioned, true)
  assert.deepEqual(removed, [barRoot])
  assert.deepEqual(added, [horrorRoot])
  assert.equal(geometry.calls, 1)
  assert.equal(interactions.length, 0)
  assert.equal(occluders.length, 0)
  assert.deepEqual(lifecycle.getBarRoots(), [])
  assert.equal(horrorRoot.visible, true)
})

test('direct activation bypasses door state while preserving lifecycle cleanup', async () => {
  const removed = []
  const added = []
  const scene = { remove: (root) => removed.push(root), add: (root) => added.push(root) }
  const barRoot = { traverse() {} }
  const horrorRoot = { visible: true }
  const lifecycle = createSceneLifecycle({ scene, loadHorrorRoom: async () => horrorRoot })
  lifecycle.setBarRoots([barRoot])
  await lifecycle.preload()

  assert.equal(lifecycle.activate(), true)
  assert.deepEqual(removed, [barRoot])
  assert.deepEqual(added, [horrorRoot])
  assert.equal(horrorRoot.visible, true)
})