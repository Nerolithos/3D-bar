import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TELEVISION_CLOSE_DURATION_MS,
  TELEVISION_REVEAL_DURATION_MS,
  createTelevisionTransition,
} from './television-transition.js'

function classList() {
  const values = new Set()
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    has: (name) => values.has(name),
  }
}

test('television transition closes fully before switching and reveals the next scene', async () => {
  const classes = classList()
  const waits = []
  const transition = createTelevisionTransition({
    host: { classList: classes },
    wait: async (duration) => { waits.push(duration) },
  })
  let switchedWhileClosed = false

  assert.equal(await transition.run(() => {
    switchedWhileClosed = classes.has('is-tv-transitioning')
    return true
  }), true)
  assert.equal(switchedWhileClosed, true)
  assert.deepEqual(waits, [TELEVISION_CLOSE_DURATION_MS, TELEVISION_REVEAL_DURATION_MS])
  assert.equal(classes.has('is-tv-transitioning'), false)
  assert.equal(classes.has('is-tv-transition-revealing'), false)
  assert.equal(transition.running, false)
})

test('television transition ignores rapid repeated entries', async () => {
  const classes = classList()
  const releases = []
  const transition = createTelevisionTransition({
    host: { classList: classes },
    wait: () => new Promise((resolve) => { releases.push(resolve) }),
  })
  const first = transition.run(() => true)
  assert.equal(await transition.run(() => true), false)
  releases.shift()()
  await new Promise((resolve) => setImmediate(resolve))
  releases.shift()()
  assert.equal(await first, true)
})
