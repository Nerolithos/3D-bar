export const GLASS_LAYOUT = Object.freeze({
  bowlBottom: .155,
  bowlTop: .29,
  bowlRadius: .052,
  iceBottom: .16,
  iceHeight: .09,
  waterCenter: .225,
  waterHeight: .09,
  waterTopRadius: .049,
  waterBottomRadius: .038,
})

export const NOTE_LAYOUT = Object.freeze({
  cafeTableTop: .97,
  cafeAnchorY: .97,
  placedOffset: .002,
})

export function getGlassVisualState(content, notePresent) {
  return {
    ice: content === 'ice',
    water: content === 'water' || content === 'cider',
    note: content === 'cider' && notePresent,
    cider: content === 'cider' && notePresent,
  }
}
