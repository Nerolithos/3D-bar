import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOOR_SYMBOLS,
  collectIceGlass,
  collectNote,
  collectRevealedNote,
  commitDoorSymbol,
  commitDialDigit,
  createGameState,
  insertCiderCard,
  insertWetNote,
  isDoorReadyToOpen,
  meltHeldGlass,
  pickupPlacedNote,
  pickupPlacedGlass,
  placeHeldGlass,
  placeHeldNote,
  setHorrorRoomStatus,
} from './game-state.js'
import { GLASS_LAYOUT, NOTE_LAYOUT, getGlassVisualState } from './glass-visual.js'

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
  assert.equal(collected.noteCollected, true)
  assert.equal(collected.heldItemId, 'wet-note')
  assert.equal(collected.note.owner, 'held')
  assert.strictEqual(collectNote(collected), collected)
})

test('dial input accepts digits only', () => {
  assert.throws(() => commitDialDigit(createGameState(), 10), /digit/)
  assert.throws(() => commitDialDigit(createGameState(), 1.5), /digit/)
})

test('only the held CIDER card can be inserted into the exit door', () => {
    const initial = createGameState()
    assert.strictEqual(insertCiderCard(initial), initial)

    const ciderCard = {
      ...initial,
      heldItemId: 'wet-note',
      noteCollected: true,
      note: { ...initial.note, owner: 'held', text: 'CIDER' },
    }
    const inserted = insertCiderCard(ciderCard)
    assert.equal(inserted.heldItemId, null)
    assert.equal(inserted.note.owner, 'door')
    assert.equal(inserted.door.cardInserted, true)
    assert.equal(inserted.door.roomStatus, 'loading')
    assert.strictEqual(insertCiderCard(inserted), inserted)
})

test('door keypad rejects the first incorrect position and allows unlimited retries', () => {
    const inserted = insertCiderCard({
      ...createGameState(),
      heldItemId: 'wet-note',
      note: { owner: 'held', slotId: null, text: 'CIDER' },
    })
    const wrong = commitDoorSymbol(inserted, 'rune-eye')
    assert.deepEqual(wrong.door.symbols, [])
    assert.equal(wrong.door.feedback, 'error')

    const retry = commitDoorSymbol(wrong, 'rune-sun')
    assert.deepEqual(retry.door.symbols, ['rune-sun'])
    assert.equal(retry.door.feedback, null)
})

test('fixed abstract symbols decode 42425142 and wait for the room', () => {
    assert.deepEqual(DOOR_SYMBOLS.map(({ digit }) => digit).sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const inserted = insertCiderCard({
      ...createGameState(),
      heldItemId: 'wet-note',
      note: { owner: 'held', slotId: null, text: 'CIDER' },
    })
    const sequence = ['rune-sun', 'rune-cross', 'rune-sun', 'rune-cross', 'rune-diamond', 'rune-fork', 'rune-sun', 'rune-cross']
    const solved = sequence.reduce(commitDoorSymbol, inserted)
    assert.equal(solved.door.keypadSolved, true)
    assert.equal(solved.door.feedback, 'success')
    assert.equal(isDoorReadyToOpen(solved), false)

    const ready = setHorrorRoomStatus(solved, 'ready')
    assert.equal(isDoorReadyToOpen(ready), true)
})

test('picking up an item immediately holds it and blocks picking up another item', () => {
  const glassHeld = collectIceGlass(createGameState())
  const unlocked = enterCode(glassHeld, '117')

  assert.equal(glassHeld.heldItemId, 'glass')
  assert.equal(glassHeld.glass.owner, 'held')
  assert.strictEqual(collectNote(unlocked), unlocked)
})

test('only a held ice glass melts into water', () => {
  const melted = meltHeldGlass(collectIceGlass(createGameState()))
  assert.equal(melted.glass.content, 'water')
  assert.strictEqual(meltHeldGlass(melted), melted)
})

test('a held glass can be placed and is picked up directly when the hand is empty', () => {
  const held = collectIceGlass(createGameState())
  const placed = placeHeldGlass(held, 'counter-2')

  assert.equal(placed.glass.owner, 'placed')
  assert.equal(placed.glass.slotId, 'counter-2')
  assert.equal(placed.placementSlots['counter-2'], 'glass')
  assert.equal(placed.heldItemId, null)
  assert.strictEqual(placeHeldGlass(placed, 'cafe-1'), placed)
  assert.strictEqual(placeHeldGlass(held, 'unknown'), held)

  const pickedUp = pickupPlacedGlass(placed)
  assert.equal(pickedUp.glass.owner, 'held')
  assert.equal(pickedUp.heldItemId, 'glass')
  assert.equal(pickedUp.glass.slotId, null)
  assert.equal(pickedUp.placementSlots['counter-2'], null)
})

test('the note can be placed at one dedicated position on either table', () => {
  const held = collectNote(enterCode(createGameState(), '117'))
  const counterPlaced = placeHeldNote(held, 'note-counter')

  assert.equal(counterPlaced.heldItemId, null)
  assert.equal(counterPlaced.note.owner, 'placed')
  assert.equal(counterPlaced.note.slotId, 'note-counter')
  assert.strictEqual(placeHeldNote(held, 'counter-1'), held)

  const pickedUp = pickupPlacedNote(counterPlaced)
  const cafePlaced = placeHeldNote(pickedUp, 'note-cafe')
  assert.equal(pickedUp.heldItemId, 'wet-note')
  assert.equal(cafePlaced.note.slotId, 'note-cafe')
})

test('wet note reveals CIDER, locks the glass in place, and only the note can be collected', () => {
  const unlocked = enterCode(createGameState(), '117')
  const icePlaced = placeHeldGlass(collectIceGlass(unlocked), 'counter-1')
  const noteHeldByIce = collectNote(icePlaced)
  assert.strictEqual(insertWetNote(noteHeldByIce), noteHeldByIce)

  const waterHeld = meltHeldGlass(pickupPlacedGlass(icePlaced))
  const waterPlaced = placeHeldGlass(waterHeld, 'cafe-1')
  const noteHeld = collectNote(waterPlaced)
  const cider = insertWetNote(noteHeld)

  assert.equal(cider.glass.content, 'cider')
  assert.equal(cider.glass.resultText, 'CIDER')
  assert.equal(cider.glass.notePresent, true)
  assert.equal(cider.heldItemId, null)
  assert.equal(cider.note.owner, 'glass')
  assert.strictEqual(insertWetNote(cider), cider)
  assert.strictEqual(pickupPlacedGlass(cider), cider)

  const collected = collectRevealedNote(cider)
  assert.equal(collected.glass.owner, 'placed')
  assert.equal(collected.glass.slotId, 'cafe-1')
  assert.equal(collected.glass.notePresent, false)
  assert.equal(collected.heldItemId, 'wet-note')
  assert.equal(collected.note.text, 'CIDER')
  assert.strictEqual(collectRevealedNote(collected), collected)
})

test('glass content visuals are mutually exclusive', () => {
  assert.deepEqual(getGlassVisualState('ice', false), {
    ice: true,
    water: false,
    note: false,
    cider: false,
  })
  assert.deepEqual(getGlassVisualState('water', false), {
    ice: false,
    water: true,
    note: false,
    cider: false,
  })
  assert.deepEqual(getGlassVisualState('cider', true), {
    ice: false,
    water: true,
    note: true,
    cider: true,
  })
})

test('ice rests entirely inside the wine-glass bowl', () => {
  assert.ok(GLASS_LAYOUT.iceBottom >= GLASS_LAYOUT.bowlBottom)
  assert.ok(GLASS_LAYOUT.iceBottom + GLASS_LAYOUT.iceHeight <= GLASS_LAYOUT.bowlTop)
  assert.ok(GLASS_LAYOUT.iceHeight / 2 <= GLASS_LAYOUT.bowlRadius)
})

test('water stays clear of the wine-glass bowl floor and narrowing sides', () => {
  const waterBottom = GLASS_LAYOUT.waterCenter - GLASS_LAYOUT.waterHeight / 2
  assert.ok(waterBottom >= GLASS_LAYOUT.bowlBottom + .02)
  assert.ok(GLASS_LAYOUT.waterBottomRadius <= .04)
  assert.ok(GLASS_LAYOUT.waterCenter + GLASS_LAYOUT.waterHeight / 2 <= GLASS_LAYOUT.bowlTop)
})

test('the cafe-table note sits flush on the tabletop', () => {
  const paperCenter = NOTE_LAYOUT.cafeAnchorY + NOTE_LAYOUT.placedOffset
  assert.ok(paperCenter >= NOTE_LAYOUT.cafeTableTop)
  assert.ok(paperCenter - NOTE_LAYOUT.cafeTableTop <= .003)
})