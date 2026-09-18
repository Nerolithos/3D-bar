import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isCandidateEligible,
  isShortClick,
  selectClickTarget,
} from './click-interactions.js'

const emptyState = {
  heldItemId: null,
  safeUnlocked: false,
  note: { owner: 'safe' },
  glass: { owner: 'scene', content: 'ice', slotId: null, notePresent: false },
  placementSlots: { 'counter-1': null },
  notePlacementSlots: { 'note-counter': null },
  door: { cardInserted: false, keypadSolved: false },
  portals: { 'pool-01': { status: 'locked', error: null } },
}

test('pointer movement up to eight CSS pixels is a click', () => {
  assert.equal(isShortClick({ x: 10, y: 20 }, { x: 16, y: 25 }, 8), true)
  assert.equal(isShortClick({ x: 10, y: 20 }, { x: 19, y: 20 }, 8), false)
})

test('the nearest eligible candidate on the ray is selected', () => {
  const near = { type: 'glass-source', id: 'glass' }
  const far = { type: 'seat', id: 'seat-1' }
  const selected = selectClickTarget([
    { distance: 1.1, candidate: far },
    { distance: .7, candidate: near },
  ], emptyState, 1.55)

  assert.strictEqual(selected, near)
})

test('one proxy selects its eligible action from multiple candidates', () => {
  const placedState = {
    ...emptyState,
    glass: { ...emptyState.glass, owner: 'placed', slotId: 'counter-1' },
  }
  const pickup = { type: 'glass-placed', slotId: 'counter-1' }
  const place = { type: 'glass-slot', slotId: 'counter-1' }

  assert.strictEqual(selectClickTarget([
    { distance: .8, candidates: [place, pickup] },
  ], placedState, 1.55), pickup)
})

test('an ineligible interaction proxy does not hide an eligible target behind it', () => {
  const unlockedState = { ...emptyState, safeUnlocked: true }
  const safe = { type: 'safe' }
  const note = { type: 'note' }

  assert.strictEqual(selectClickTarget([
    { distance: .7, candidate: safe },
    { distance: .8, candidate: note },
  ], unlockedState, 1.55), note)
})

test('a closer scene surface occludes an interaction target', () => {
  const target = { type: 'seat', id: 'seat-1' }
  const selected = selectClickTarget([
    { distance: 1.2, candidate: target },
    { distance: .6, blocksInteraction: true },
  ], emptyState, 1.55)

  assert.equal(selected, null)
})

test('targets beyond interaction distance are rejected', () => {
  const target = { type: 'safe', id: 'safe' }
  assert.equal(selectClickTarget([{ distance: 1.56, candidate: target }], emptyState, 1.55), null)
})

test('held items permit only their matching actions', () => {
  const glassHeld = {
    ...emptyState,
    heldItemId: 'glass',
    glass: { ...emptyState.glass, owner: 'held' },
  }
  assert.equal(isCandidateEligible({ type: 'candle' }, glassHeld), true)
  assert.equal(isCandidateEligible({ type: 'glass-slot', slotId: 'counter-1' }, glassHeld), true)
  assert.equal(isCandidateEligible({ type: 'seat' }, glassHeld), false)

  const noteHeld = {
    ...emptyState,
    heldItemId: 'wet-note',
    note: { owner: 'held' },
    glass: { owner: 'placed', content: 'water', slotId: 'counter-1', notePresent: false },
  }
  assert.equal(isCandidateEligible({ type: 'glass-placed', slotId: 'counter-1' }, noteHeld), true)
  assert.equal(isCandidateEligible({ type: 'note-slot', slotId: 'note-counter' }, noteHeld), true)
  assert.equal(isCandidateEligible({ type: 'safe' }, noteHeld), false)
})

test('TV screen is not interactive during its timed anomaly', () => {
  assert.equal(isCandidateEligible({ type: 'tv-screen', disabled: true }, emptyState), false)
  assert.equal(isCandidateEligible({ type: 'tv-screen', disabled: false }, emptyState), true)
})

test('door card slot only accepts the held CIDER card', () => {
  const wetNote = {
    ...emptyState,
    heldItemId: 'wet-note',
    note: { owner: 'held', text: 'wet' },
  }
  const ciderCard = { ...wetNote, note: { owner: 'held', text: 'CIDER' } }

  assert.equal(isCandidateEligible({ type: 'door-card-slot' }, emptyState), false)
  assert.equal(isCandidateEligible({ type: 'door-card-slot' }, wetNote), false)
  assert.equal(isCandidateEligible({ type: 'door-card-slot' }, ciderCard), true)
})

test('door keypad is available only after card insertion and before solve', () => {
  assert.equal(isCandidateEligible({ type: 'door-keypad' }, emptyState), false)
  const inserted = { ...emptyState, door: { cardInserted: true, keypadSolved: false } }
  assert.equal(isCandidateEligible({ type: 'door-keypad' }, inserted), true)
  const solved = { ...inserted, door: { cardInserted: true, keypadSolved: true } }
  assert.equal(isCandidateEligible({ type: 'door-keypad' }, solved), false)
})

test('pool portal is clickable only when ready or retryable after an error', () => {
  const candidate = { type: 'portal-screen', portalId: 'pool-01' }
  const withStatus = (status) => ({
    ...emptyState,
    portals: { 'pool-01': { status, error: status === 'error' ? 'network' : null } },
  })

  assert.equal(isCandidateEligible(candidate, withStatus('locked')), false)
  assert.equal(isCandidateEligible(candidate, withStatus('loading')), false)
  assert.equal(isCandidateEligible(candidate, withStatus('ready')), true)
  assert.equal(isCandidateEligible(candidate, withStatus('error')), true)
  assert.equal(isCandidateEligible(candidate, withStatus('entering')), false)
})
