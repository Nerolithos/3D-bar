import assert from 'node:assert/strict'
import test from 'node:test'

import { createPortalLifecycle } from './portal-lifecycle.js'

function root(name) {
  return { name, visible: true, removeFromParent() {}, traverse() {} }
}

test('portal preload is idempotent and a failed load remains retryable', async () => {
  let calls = 0
  const pool = root('pool')
  const lifecycle = createPortalLifecycle({
    scene: { add() {}, remove() {} },
    loadPortal: async () => {
      calls += 1
      if (calls === 1) throw new Error('network')
      return pool
    },
  })

  await assert.rejects(lifecycle.preload('pool-01'), /network/)
  const first = lifecycle.preload('pool-01')
  const second = lifecycle.preload('pool-01')
  assert.strictEqual(first, second)
  assert.strictEqual(await first, pool)
  assert.equal(calls, 2)
  assert.equal(pool.visible, false)
})

test('portal transition runs once and disposes the previous scene', async () => {
  const removed = []
  const added = []
  const horror = root('horror')
  const pool = root('pool')
  const lifecycle = createPortalLifecycle({
    scene: { add: (value) => added.push(value), remove: (value) => removed.push(value) },
    loadPortal: async () => pool,
  })
  lifecycle.setCurrentRoots([horror])
  await lifecycle.preload('pool-01')

  assert.equal(lifecycle.transition('pool-01'), true)
  assert.equal(lifecycle.transition('pool-01'), false)
  assert.deepEqual(removed, [horror])
  assert.deepEqual(added, [pool])
  assert.equal(pool.visible, true)
})

test('reversible portal preserves the horror room and reuses the preloaded pool', async () => {
  const removed = []
  const added = []
  const horror = root('horror')
  const pool = root('pool')
  const lifecycle = createPortalLifecycle({
    scene: { add: (value) => added.push(value), remove: (value) => removed.push(value) },
    loadPortal: async () => pool,
  })
  lifecycle.setCurrentRoots([horror])
  await lifecycle.preload('pool-01')
  assert.equal(lifecycle.transition('pool-01', { preserveCurrent: true }), true)
  assert.equal(horror.visible, false)
  assert.equal(lifecycle.returnToPrevious(), true)
  assert.equal(pool.visible, false)
  assert.equal(horror.visible, true)
  assert.equal(lifecycle.transition('pool-01', { preserveCurrent: true }), true)
  assert.deepEqual(added, [pool, horror, pool])
})
