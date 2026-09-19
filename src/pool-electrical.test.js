import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advancePoolElectricalState,
  createPoolElectricalState,
  resetPoolElectricalAfterDeath,
  startPoolElectricalSequence,
  unlockSecondPoolTelevision,
} from './pool-electrical.js'

function advance(state, seconds, context) {
  let next = state
  for (let elapsed = 0; elapsed < seconds; elapsed += .25) {
    next = advancePoolElectricalState(next, Math.min(.25, seconds - elapsed), context)
  }
  return next
}

test('submerged television runs a red five-second countdown once', () => {
  const idle = createPoolElectricalState()
  const countdown = startPoolElectricalSequence(idle)
  assert.equal(countdown.phase, 'countdown')
  assert.strictEqual(startPoolElectricalSequence(countdown), countdown)
  const nearly = advance(countdown, 4.1, { onFloat: false, firstPuzzleSolved: false })
  assert.equal(nearly.countdownValue, 1)
})

test('discharge kills players in water or on the ladder', () => {
  const countdown = startPoolElectricalSequence(createPoolElectricalState())
  const water = advance(countdown, 5, { onFloat: false, firstPuzzleSolved: true })
  assert.equal(water.phase, 'discharge')
  assert.equal(water.outcome, 'dead')
})

test('blue float survives three seconds of discharge and extends a solved ladder', () => {
  const countdown = startPoolElectricalSequence(createPoolElectricalState())
  const discharge = advance(countdown, 6.5, { onFloat: true, firstPuzzleSolved: true })
  assert.equal(discharge.phase, 'discharge')
  assert.equal(discharge.outcome, 'safe')
  assert.equal(discharge.ladderExtension, .5)
  const complete = advance(discharge, 1.5, { onFloat: true, firstPuzzleSolved: true })
  assert.equal(complete.phase, 'complete')
  assert.equal(complete.ladderExtension, 1)
})

test('death reset preserves unlocked horror-room progress', () => {
  const unlocked = unlockSecondPoolTelevision(createPoolElectricalState())
  assert.equal(unlocked.secondTvUnlocked, true)
  assert.strictEqual(unlockSecondPoolTelevision(unlocked), unlocked)
  const reset = resetPoolElectricalAfterDeath({ ...unlocked, phase: 'discharge', outcome: 'dead' })
  assert.equal(reset.phase, 'idle')
  assert.equal(reset.secondTvUnlocked, true)
})

test('a safe discharge can be retried until it extends the solved ladder', () => {
  let state = startPoolElectricalSequence(createPoolElectricalState())
  state = advance(state, 8, { onFloat: true, firstPuzzleSolved: false })
  assert.equal(state.phase, 'complete')
  assert.equal(state.ladderExtension, 0)

  const retry = startPoolElectricalSequence(state)
  assert.equal(retry.phase, 'countdown')
  assert.equal(retry.outcome, null)
})
