import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectNote,
  commitDialDigit,
  createGameState,
  selectInventoryItem,
  toggleInventory,
} from './game-state.js'

function enterCode(state, code) {
  return [...code].reduce(
    (current, digit) => commitDialDigit(current, Number(digit)),
    state,
  )
}

test('an incorrect three-digit code resets the dial and keeps the safe locked', () => {
  const state = enterCode(createGameState(), '116')

  assert.equal(state.safeUnlocked, false)
  assert.deepEqual(state.dialDigits, [])
  assert.equal(state.dialFeedback, 'error')
})

test('117 unlocks the safe', () => {
  const state = enterCode(createGameState(), '117')

  assert.equal(state.safeUnlocked, true)
  assert.deepEqual(state.dialDigits, [1, 1, 7])
  assert.equal(state.dialFeedback, 'success')
})

test('the note can only be collected once the safe is unlocked', () => {
  const locked = collectNote(createGameState())
  const unlocked = enterCode(createGameState(), '117')
  const collected = collectNote(unlocked)

  assert.equal(locked.noteCollected, false)
  assert.deepEqual(locked.inventory, [])
  assert.equal(collected.noteCollected, true)
  assert.deepEqual(collected.inventory, [
    { id: 'wet-note', label: '潮湿的纸条', text: 'wet' },
  ])
  assert.strictEqual(collectNote(collected), collected)
})

test('inventory visibility toggles and the collected note can be selected', () => {
  const collected = collectNote(enterCode(createGameState(), '117'))
  const opened = toggleInventory(collected)
  const selected = selectInventoryItem(opened, 'wet-note')
  const closed = toggleInventory(selected)

  assert.equal(opened.inventoryOpen, true)
  assert.equal(selected.selectedItemId, 'wet-note')
  assert.equal(closed.inventoryOpen, false)
})

test('dial input accepts digits only', () => {
  assert.throws(() => commitDialDigit(createGameState(), 10), /digit/)
  assert.throws(() => commitDialDigit(createGameState(), 1.5), /digit/)
})