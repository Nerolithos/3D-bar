const WET_NOTE = Object.freeze({
  id: 'wet-note',
  label: '潮湿的纸条',
  text: 'wet',
})

export function createGameState() {
  return {
    dialDigits: [],
    dialFeedback: null,
    safeUnlocked: false,
    noteCollected: false,
    inventory: [],
    inventoryOpen: false,
    selectedItemId: null,
  }
}

export function commitDialDigit(state, digit) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new RangeError('Dial digit must be an integer from 0 through 9')
  }
  if (state.safeUnlocked) return state

  const dialDigits = [...state.dialDigits, digit]
  if (dialDigits.length < 3) {
    return { ...state, dialDigits, dialFeedback: null }
  }
  if (dialDigits.join('') === '117') {
    return { ...state, dialDigits, dialFeedback: 'success', safeUnlocked: true }
  }
  return { ...state, dialDigits: [], dialFeedback: 'error' }
}

export function collectNote(state) {
  if (!state.safeUnlocked || state.noteCollected) return state
  return {
    ...state,
    noteCollected: true,
    inventory: [WET_NOTE],
  }
}

export function toggleInventory(state) {
  return { ...state, inventoryOpen: !state.inventoryOpen }
}

export function selectInventoryItem(state, itemId) {
  if (!state.inventory.some((item) => item.id === itemId)) return state
  return { ...state, selectedItemId: itemId }
}