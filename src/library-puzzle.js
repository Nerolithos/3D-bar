export const LIBRARY_EYE_SEQUENCE = Object.freeze(['left', 'right', 'center', 'right', 'left', 'center'])
export const LIBRARY_BOOK_SEQUENCE = Object.freeze([
  'left-crimson', 'right-indigo', 'back-amber',
  'right-indigo', 'left-crimson', 'back-amber',
])

const EYE_STEP_SECONDS = 1.18
const EYE_ON_SECONDS = .88
const SUCCESS_FLASH_SECONDS = 2.5
export const LIBRARY_BLACKOUT_ROW_SECONDS = 3.8
export const LIBRARY_SURVIVAL_RESTORE_SECONDS = 3

export function createLibraryPuzzleState() {
  return {
    phase: 'idle',
    lightsOn: true,
    elapsed: 0,
    eyeTarget: null,
    eyeVisible: false,
    eyeStep: -1,
    inputIndex: 0,
    rewardVisible: false,
    rewardOpened: false,
    blackoutProgress: 0,
  }
}

export function toggleLibraryPuzzleLights(state) {
  if (['eye-sequence', 'success-flash', 'blackout', 'blackout-deadline', 'survived', 'failed'].includes(state.phase)) return state
  if (state.lightsOn && (state.phase === 'idle' || state.phase === 'awaiting-input')) {
    return {
      ...state,
      phase: 'eye-sequence',
      lightsOn: false,
      elapsed: 0,
      eyeTarget: 'left',
      eyeVisible: true,
      eyeStep: 0,
      inputIndex: 0,
    }
  }
  if (state.phase === 'awaiting-light' && !state.lightsOn) {
    return { ...state, phase: 'awaiting-input', lightsOn: true, inputIndex: 0 }
  }
  return { ...state, lightsOn: !state.lightsOn }
}

export function updateLibraryPuzzle(state, deltaTime) {
  if (state.phase === 'eye-sequence') {
    const elapsed = state.elapsed + Math.max(0, deltaTime)
    const step = Math.floor(elapsed / EYE_STEP_SECONDS)
    if (step >= LIBRARY_EYE_SEQUENCE.length) {
      return { ...state, phase: 'awaiting-light', elapsed: 0, eyeTarget: null, eyeVisible: false, eyeStep: 6 }
    }
    return {
      ...state,
      elapsed,
      eyeTarget: LIBRARY_EYE_SEQUENCE[step],
      eyeVisible: elapsed % EYE_STEP_SECONDS < EYE_ON_SECONDS,
      eyeStep: step,
    }
  }
  if (state.phase === 'success-flash') {
    const elapsed = state.elapsed + Math.max(0, deltaTime)
    if (elapsed >= SUCCESS_FLASH_SECONDS) {
      return { ...state, phase: 'blackout', lightsOn: true, elapsed: 0, blackoutProgress: 0 }
    }
    return { ...state, elapsed, lightsOn: Math.floor(elapsed / .22) % 2 === 0 }
  }
  if (state.phase === 'blackout') {
    const elapsed = state.elapsed + Math.max(0, deltaTime)
    const blackoutProgress = Math.min(3, elapsed / LIBRARY_BLACKOUT_ROW_SECONDS)
    if (blackoutProgress >= 3) {
      return { ...state, phase: 'blackout-deadline', lightsOn: false, elapsed, blackoutProgress: 3 }
    }
    return { ...state, elapsed, blackoutProgress }
  }
  if (state.phase === 'survived') {
    const elapsed = state.elapsed + Math.max(0, deltaTime)
    if (elapsed >= LIBRARY_SURVIVAL_RESTORE_SECONDS) {
      return { ...state, phase: 'reward', lightsOn: true, elapsed: 0, rewardVisible: true }
    }
    return { ...state, elapsed }
  }
  return state
}

export function getLibraryLightRowLevels(state) {
  if (state.phase === 'survived') return [0, 0, 0]
  if (state.phase === 'blackout' || state.phase === 'blackout-deadline' || state.phase === 'failed') {
    const progress = state.blackoutProgress ?? 0
    return [
      Math.max(0, Math.min(1, 3 - progress)),
      Math.max(0, Math.min(1, 2 - progress)),
      Math.max(0, Math.min(1, 1 - progress)),
    ]
  }
  const level = state.lightsOn ? 1 : 0
  return [level, level, level]
}

export function resolveLibraryEscape(state, survived) {
  if (state.phase !== 'blackout-deadline') return state
  return survived
    ? { ...state, phase: 'survived', lightsOn: true, elapsed: 0 }
    : { ...state, phase: 'failed', lightsOn: false, elapsed: 0 }
}

export function recordLibraryBookAction(state, bookId) {
  if (state.phase !== 'awaiting-input' || !state.lightsOn) return { state, accepted: false, solved: false, reset: false }
  const expected = LIBRARY_BOOK_SEQUENCE[state.inputIndex]
  if (bookId !== expected) {
    return {
      state: { ...state, inputIndex: 0 },
      accepted: false,
      solved: false,
      reset: true,
    }
  }
  const inputIndex = state.inputIndex + 1
  if (inputIndex === LIBRARY_BOOK_SEQUENCE.length) {
    return {
      state: { ...state, phase: 'success-flash', elapsed: 0, inputIndex },
      accepted: true,
      solved: true,
      reset: false,
    }
  }
  return {
    state: { ...state, inputIndex },
    accepted: true,
    solved: false,
    reset: false,
  }
}

export function openLibraryRewardBook(state) {
  return state.phase === 'reward' && state.rewardVisible && !state.rewardOpened
    ? { ...state, rewardOpened: true }
    : state
}
