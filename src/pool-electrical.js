export const POOL_COUNTDOWN_SECONDS = 5
export const POOL_DISCHARGE_SECONDS = 3

export function createPoolElectricalState() {
  return Object.freeze({
    phase: 'idle',
    elapsed: 0,
    countdownValue: 5,
    outcome: null,
    ladderExtension: 0,
    secondTvUnlocked: false,
  })
}

export function startPoolElectricalSequence(state) {
  const retryable = state.phase === 'complete' && state.ladderExtension < 1
  if (state.phase !== 'idle' && !retryable) return state
  return Object.freeze({
    ...state,
    phase: 'countdown',
    elapsed: 0,
    countdownValue: 5,
    outcome: null,
    ladderExtension: 0,
  })
}

export function advancePoolElectricalState(state, deltaTime, { onFloat, firstPuzzleSolved }) {
  const delta = Math.max(0, Math.min(deltaTime, .25))
  if (!delta || !['countdown', 'discharge'].includes(state.phase)) return state
  if (state.phase === 'countdown') {
    const elapsed = state.elapsed + delta
    if (elapsed < POOL_COUNTDOWN_SECONDS) {
      return Object.freeze({
        ...state,
        elapsed,
        countdownValue: Math.max(1, Math.ceil(POOL_COUNTDOWN_SECONDS - elapsed)),
      })
    }
    const dischargeElapsed = elapsed - POOL_COUNTDOWN_SECONDS
    return Object.freeze({
      ...state,
      phase: 'discharge',
      elapsed: dischargeElapsed,
      countdownValue: 0,
      outcome: onFloat ? 'safe' : 'dead',
      ladderExtension: firstPuzzleSolved
        ? Math.min(1, dischargeElapsed / POOL_DISCHARGE_SECONDS)
        : 0,
    })
  }
  const elapsed = Math.min(POOL_DISCHARGE_SECONDS, state.elapsed + delta)
  const ladderExtension = firstPuzzleSolved ? elapsed / POOL_DISCHARGE_SECONDS : 0
  if (elapsed < POOL_DISCHARGE_SECONDS) {
    return Object.freeze({ ...state, elapsed, ladderExtension })
  }
  return Object.freeze({
    ...state,
    phase: state.outcome === 'safe' ? 'complete' : 'discharge',
    elapsed,
    ladderExtension,
  })
}

export function resetPoolElectricalAfterDeath(state) {
  return Object.freeze({
    ...createPoolElectricalState(),
    secondTvUnlocked: state.secondTvUnlocked,
  })
}

export function unlockSecondPoolTelevision(state) {
  if (state.secondTvUnlocked) return state
  return Object.freeze({ ...state, secondTvUnlocked: true })
}
