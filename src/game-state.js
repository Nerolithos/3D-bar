const GLASS_SLOT_IDS = Object.freeze([
  'counter-1',
  'counter-2',
  'counter-3',
  'cafe-1',
  'cafe-2',
])

const NOTE_SLOT_IDS = Object.freeze(['note-counter', 'note-cafe'])

export const DOOR_SYMBOLS = Object.freeze([
  Object.freeze({ id: 'rune-ring', digit: 0 }),
  Object.freeze({ id: 'rune-fork', digit: 1 }),
  Object.freeze({ id: 'rune-cross', digit: 2 }),
  Object.freeze({ id: 'rune-wave', digit: 3 }),
  Object.freeze({ id: 'rune-sun', digit: 4 }),
  Object.freeze({ id: 'rune-diamond', digit: 5 }),
  Object.freeze({ id: 'rune-eye', digit: 6 }),
  Object.freeze({ id: 'rune-ladder', digit: 7 }),
  Object.freeze({ id: 'rune-spiral', digit: 8 }),
  Object.freeze({ id: 'rune-crown', digit: 9 }),
])

const DOOR_CODE = '42425142'
const DOOR_DIGITS_BY_SYMBOL = new Map(DOOR_SYMBOLS.map(({ id, digit }) => [id, digit]))
const HORROR_ROOM_STATUSES = new Set(['idle', 'loading', 'ready', 'error'])

export function createGameState() {
  return {
    dialDigits: [],
    dialFeedback: null,
    safeUnlocked: false,
    noteCollected: false,
    heldItemId: null,
    glass: {
      content: 'ice',
      owner: 'scene',
      slotId: null,
      resultText: null,
      notePresent: false,
    },
    note: {
      owner: 'safe',
      slotId: null,
      text: 'wet',
    },
    door: {
      cardInserted: false,
      symbols: [],
      feedback: null,
      keypadSolved: false,
      roomStatus: 'idle',
      entered: false,
    },
    placementSlots: Object.fromEntries(GLASS_SLOT_IDS.map((slotId) => [slotId, null])),
    notePlacementSlots: Object.fromEntries(NOTE_SLOT_IDS.map((slotId) => [slotId, null])),
  }
}

export function commitDialDigit(state, digit) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new RangeError('Dial digit must be an integer from 0 through 9')
  }
  if (state.safeUnlocked) return state

  const dialDigits = [...state.dialDigits, digit]
  if (dialDigits.length < 3) return { ...state, dialDigits, dialFeedback: null }
  if (dialDigits.join('') === '117') {
    return { ...state, dialDigits, dialFeedback: 'success', safeUnlocked: true }
  }
  return { ...state, dialDigits: [], dialFeedback: 'error' }
}

export function collectNote(state) {
  if (!state.safeUnlocked || state.noteCollected || state.heldItemId || state.note.owner !== 'safe') return state
  return {
    ...state,
    noteCollected: true,
    heldItemId: 'wet-note',
    note: { ...state.note, owner: 'held' },
  }
}

export function collectIceGlass(state) {
  if (state.heldItemId || state.glass.owner !== 'scene') return state
  return {
    ...state,
    heldItemId: 'glass',
    glass: { ...state.glass, owner: 'held' },
  }
}

export function meltHeldGlass(state) {
  if (state.heldItemId !== 'glass' || state.glass.owner !== 'held' || state.glass.content !== 'ice') return state
  return { ...state, glass: { ...state.glass, content: 'water' } }
}

export function placeHeldGlass(state, slotId) {
  if (state.heldItemId !== 'glass' ||
      state.glass.owner !== 'held' ||
      !Object.hasOwn(state.placementSlots, slotId) ||
      state.placementSlots[slotId] !== null) return state
  return {
    ...state,
    heldItemId: null,
    glass: { ...state.glass, owner: 'placed', slotId },
    placementSlots: { ...state.placementSlots, [slotId]: 'glass' },
  }
}

export function pickupPlacedGlass(state) {
  if (state.heldItemId || state.glass.owner !== 'placed' || !state.glass.slotId || state.glass.content === 'cider') return state
  return {
    ...state,
    heldItemId: 'glass',
    glass: { ...state.glass, owner: 'held', slotId: null },
    placementSlots: { ...state.placementSlots, [state.glass.slotId]: null },
  }
}

export function placeHeldNote(state, slotId) {
  if (state.heldItemId !== 'wet-note' ||
      state.note.owner !== 'held' ||
      !Object.hasOwn(state.notePlacementSlots, slotId) ||
      state.notePlacementSlots[slotId] !== null) return state
  return {
    ...state,
    heldItemId: null,
    note: { ...state.note, owner: 'placed', slotId },
    notePlacementSlots: { ...state.notePlacementSlots, [slotId]: 'wet-note' },
  }
}

export function pickupPlacedNote(state) {
  if (state.heldItemId || state.note.owner !== 'placed' || !state.note.slotId) return state
  return {
    ...state,
    heldItemId: 'wet-note',
    note: { ...state.note, owner: 'held', slotId: null },
    notePlacementSlots: { ...state.notePlacementSlots, [state.note.slotId]: null },
  }
}

export function insertWetNote(state) {
  if (state.heldItemId !== 'wet-note' ||
      state.note.owner !== 'held' ||
      state.glass.owner !== 'placed' ||
      state.glass.content !== 'water') return state
  return {
    ...state,
    heldItemId: null,
    glass: { ...state.glass, content: 'cider', resultText: 'CIDER', notePresent: true },
    note: { ...state.note, owner: 'glass', slotId: null, text: 'CIDER' },
  }
}

export function collectRevealedNote(state) {
  if (state.heldItemId || state.glass.owner !== 'placed' ||
      state.glass.content !== 'cider' || !state.glass.notePresent) return state
  return {
    ...state,
    heldItemId: 'wet-note',
    glass: { ...state.glass, notePresent: false },
    note: { ...state.note, owner: 'held', text: 'CIDER' },
  }
}

export function insertCiderCard(state) {
  if (state.door.cardInserted || state.heldItemId !== 'wet-note' ||
      state.note.owner !== 'held' || state.note.text !== 'CIDER') return state
  return {
    ...state,
    heldItemId: null,
    note: { ...state.note, owner: 'door', slotId: null },
    door: { ...state.door, cardInserted: true, roomStatus: 'loading' },
  }
}

export function commitDoorSymbol(state, symbolId) {
  if (!DOOR_DIGITS_BY_SYMBOL.has(symbolId)) {
    throw new RangeError('Unknown door symbol')
  }
  if (!state.door.cardInserted || state.door.keypadSolved) return state

  const symbols = [...state.door.symbols, symbolId]
  const digits = symbols.map((id) => DOOR_DIGITS_BY_SYMBOL.get(id)).join('')
  if (!DOOR_CODE.startsWith(digits)) {
    return { ...state, door: { ...state.door, symbols: [], feedback: 'error' } }
  }
  if (digits === DOOR_CODE) {
    return { ...state, door: { ...state.door, symbols, feedback: 'success', keypadSolved: true } }
  }
  return { ...state, door: { ...state.door, symbols, feedback: null } }
}

export function setHorrorRoomStatus(state, roomStatus) {
  if (!HORROR_ROOM_STATUSES.has(roomStatus)) {
    throw new RangeError('Unknown horror room status')
  }
  if (state.door.roomStatus === roomStatus) return state
  return { ...state, door: { ...state.door, roomStatus } }
}

export function isDoorReadyToOpen(state) {
  return state.door.keypadSolved && state.door.roomStatus === 'ready'
}
