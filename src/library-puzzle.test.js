import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LIBRARY_BLACKOUT_ROW_SECONDS,
  LIBRARY_SURVIVAL_RESTORE_SECONDS,
  LIBRARY_BOOK_SEQUENCE,
  LIBRARY_EYE_SEQUENCE,
  createLibraryPuzzleState,
  getLibraryLightRowLevels,
  openLibraryRewardBook,
  recordLibraryBookAction,
  resolveLibraryEscape,
  toggleLibraryPuzzleLights,
  updateLibraryPuzzle,
} from './library-puzzle.js'

test('switching the lights off shows the six eyes in left-right-center-right-left-center order', () => {
  let state = toggleLibraryPuzzleLights(createLibraryPuzzleState())
  assert.equal(state.lightsOn, false)
  const seen = []
  for (let index = 0; index < LIBRARY_EYE_SEQUENCE.length; index += 1) {
    state = updateLibraryPuzzle(state, index === 0 ? 0 : 1.18)
    seen.push(state.eyeTarget)
  }
  assert.deepEqual(seen, ['left', 'right', 'center', 'right', 'left', 'center'])
  state = updateLibraryPuzzle(state, 1.18)
  assert.equal(state.phase, 'awaiting-light')
  assert.equal(state.eyeVisible, false)
})

test('the same six-book pull and return sequence solves after the lights are restored', () => {
  let state = toggleLibraryPuzzleLights(createLibraryPuzzleState())
  state = updateLibraryPuzzle(state, 1.18 * LIBRARY_EYE_SEQUENCE.length)
  state = toggleLibraryPuzzleLights(state)
  assert.equal(state.phase, 'awaiting-input')
  for (const bookId of LIBRARY_BOOK_SEQUENCE) {
    const result = recordLibraryBookAction(state, bookId)
    state = result.state
  }
  assert.equal(state.phase, 'success-flash')
})

test('a wrong book resets input, then success starts a far-to-near three-row blackout', () => {
  let state = toggleLibraryPuzzleLights(createLibraryPuzzleState())
  state = updateLibraryPuzzle(state, 1.18 * LIBRARY_EYE_SEQUENCE.length)
  state = toggleLibraryPuzzleLights(state)
  const wrong = recordLibraryBookAction(state, 'back-amber')
  assert.equal(wrong.reset, true)
  state = wrong.state
  for (const bookId of LIBRARY_BOOK_SEQUENCE) state = recordLibraryBookAction(state, bookId).state
  state = updateLibraryPuzzle(state, 2.5)
  assert.equal(state.phase, 'blackout')
  assert.deepEqual(getLibraryLightRowLevels(state), [1, 1, 1])
  state = updateLibraryPuzzle(state, LIBRARY_BLACKOUT_ROW_SECONDS * .5)
  assert.deepEqual(getLibraryLightRowLevels(state), [1, 1, .5])
  state = updateLibraryPuzzle(state, LIBRARY_BLACKOUT_ROW_SECONDS)
  assert.ok(Math.abs(getLibraryLightRowLevels(state)[1] - .5) < 1e-9)
  assert.equal(getLibraryLightRowLevels(state)[2], 0)
  state = updateLibraryPuzzle(state, LIBRARY_BLACKOUT_ROW_SECONDS)
  assert.ok(Math.abs(getLibraryLightRowLevels(state)[0] - .5) < 1e-9)
  assert.deepEqual(getLibraryLightRowLevels(state).slice(1), [0, 0])
  state = updateLibraryPuzzle(state, LIBRARY_BLACKOUT_ROW_SECONDS * .5)
  assert.equal(state.phase, 'blackout-deadline')
  assert.deepEqual(getLibraryLightRowLevels(state), [0, 0, 0])
  state = resolveLibraryEscape(state, true)
  assert.equal(state.phase, 'survived')
  assert.deepEqual(getLibraryLightRowLevels(state), [0, 0, 0])
  state = updateLibraryPuzzle(state, LIBRARY_SURVIVAL_RESTORE_SECONDS)
  assert.equal(state.phase, 'reward')
  assert.equal(state.rewardVisible, true)
  state = openLibraryRewardBook(state)
  assert.equal(state.rewardOpened, true)
})

test('missing the elevator deadline produces a failed state and reset restores the whole level', () => {
  let state = createLibraryPuzzleState()
  state = { ...state, phase: 'blackout-deadline', lightsOn: false, blackoutProgress: 3 }
  state = resolveLibraryEscape(state, false)
  assert.equal(state.phase, 'failed')
  assert.deepEqual(createLibraryPuzzleState(), {
    phase: 'idle', lightsOn: true, elapsed: 0, eyeTarget: null, eyeVisible: false,
    eyeStep: -1, inputIndex: 0, rewardVisible: false, rewardOpened: false,
    blackoutProgress: 0,
  })
})

test('the blackout window permits walking from the farthest shelf and closing the doors', () => {
  const farthestShelfToElevator = 17.6
  const walkingSpeed = 2.8
  const fullDoorCloseSeconds = 2.05
  const aimingAllowanceSeconds = 1
  const escapeWindow = LIBRARY_BLACKOUT_ROW_SECONDS * 3
  assert.ok(escapeWindow > farthestShelfToElevator / walkingSpeed + fullDoorCloseSeconds + aimingAllowanceSeconds)
})

test('switching off again before success replays all six eyes and resets partial input', () => {
  let state = toggleLibraryPuzzleLights(createLibraryPuzzleState())
  state = updateLibraryPuzzle(state, 1.18 * LIBRARY_EYE_SEQUENCE.length)
  state = toggleLibraryPuzzleLights(state)
  state = recordLibraryBookAction(state, 'left-crimson').state
  assert.equal(state.inputIndex, 1)
  state = toggleLibraryPuzzleLights(state)
  assert.equal(state.phase, 'eye-sequence')
  assert.equal(state.eyeStep, 0)
  assert.equal(state.inputIndex, 0)
})
