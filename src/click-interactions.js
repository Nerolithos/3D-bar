export function isShortClick(start, end, threshold = 8) {
  return Math.hypot(end.x - start.x, end.y - start.y) <= threshold
}

export function isCandidateEligible(candidate, state) {
  if (candidate.disabled) return false
  const heldItemId = state.heldItemId
  const allowedWhileHoldingGlass = ['candle', 'glass-slot'].includes(candidate.type)
  const allowedWhileHoldingNote = candidate.type === 'note-slot' ||
    (candidate.type === 'glass-placed' && state.glass.content === 'water') ||
    candidate.type === 'door-card-slot'

  if (heldItemId === 'glass' && !allowedWhileHoldingGlass) return false
  if (heldItemId === 'wet-note' && !allowedWhileHoldingNote) return false
  if (!heldItemId && ['candle', 'glass-slot', 'note-slot'].includes(candidate.type)) return false
  if (candidate.type === 'safe' && state.safeUnlocked) return false
  if (candidate.type === 'note' && (!state.safeUnlocked || state.note.owner !== 'safe')) return false
  if (candidate.type === 'glass-source' && state.glass.owner !== 'scene') return false
  if (candidate.type === 'glass-placed' &&
      (state.glass.owner !== 'placed' || state.glass.slotId !== candidate.slotId)) return false
  if (candidate.type === 'glass-placed' &&
      state.glass.content === 'cider' && !state.glass.notePresent) return false
  if (candidate.type === 'candle' &&
      (heldItemId !== 'glass' || state.glass.content !== 'ice')) return false
  if (candidate.type === 'glass-slot' &&
      (heldItemId !== 'glass' || state.placementSlots[candidate.slotId])) return false
  if (candidate.type === 'note-slot' &&
      (heldItemId !== 'wet-note' || state.notePlacementSlots[candidate.slotId])) return false
  if (candidate.type === 'note-placed' &&
      (state.note.owner !== 'placed' || state.note.slotId !== candidate.slotId)) return false
    if (candidate.type === 'door-card-slot' &&
      (heldItemId !== 'wet-note' || state.note.owner !== 'held' ||
       state.note.text !== 'CIDER' || state.door.cardInserted)) return false
    if (candidate.type === 'door-keypad' &&
      (!state.door.cardInserted || state.door.keypadSolved)) return false
  return true
}

export function selectClickTarget(hits, state, maxDistance) {
  const sortedHits = [...hits].sort((left, right) => left.distance - right.distance)
  for (const hit of sortedHits) {
    if (hit.distance > maxDistance) return null
    if (hit.candidates) {
      const candidate = hit.candidates.find((item) => isCandidateEligible(item, state))
      if (candidate) return candidate
      continue
    }
    if (hit.candidate) {
      if (isCandidateEligible(hit.candidate, state)) return hit.candidate
      continue
    }
    if (hit.blocksInteraction) return null
  }
  return null
}
