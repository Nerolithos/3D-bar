import assert from 'node:assert/strict'
import test from 'node:test'

import {
  POOL_DUCKS,
  createPoolPuzzleState,
  rotatePoolDuck,
} from './pool-puzzle.js'

test('each of the three ducks rotates independently in eighth-turn steps', () => {
  const initial = createPoolPuzzleState()
  const rotated = rotatePoolDuck(initial, 'duck-2')
  assert.equal(rotated.ducks['duck-1'].step, 0)
  assert.equal(rotated.ducks['duck-2'].step, 1)
  assert.equal(rotated.ducks['duck-2'].angle, Math.PI / 4)
  assert.equal(rotated.ducks['duck-3'].step, 0)
  assert.equal(rotated.solved, false)
})

test('the ladder stage solves only when all ducks match their discrete right-wall faucets', () => {
  let state = createPoolPuzzleState()
  for (let index = 0; index < POOL_DUCKS[0].targetStep; index += 1) state = rotatePoolDuck(state, 'duck-1')
  assert.equal(state.solved, false)
  for (let index = 0; index < POOL_DUCKS[1].targetStep; index += 1) state = rotatePoolDuck(state, 'duck-2')
  assert.equal(state.solved, false)
  for (let index = 0; index < POOL_DUCKS[2].targetStep; index += 1) state = rotatePoolDuck(state, 'duck-3')
  assert.equal(state.solved, true)
  assert.strictEqual(rotatePoolDuck(state, 'duck-1'), state)
})

test('duck targets use the human-verified visual directions', () => {
  assert.deepEqual(POOL_DUCKS.map(({ targetStep }) => targetStep), [0, 3, 5])
})

test('unknown ducks do not mutate puzzle state', () => {
  const state = createPoolPuzzleState()
  assert.strictEqual(rotatePoolDuck(state, 'duck-99'), state)
})
