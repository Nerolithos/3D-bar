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
