export const POOL_DUCK_STEP_COUNT = 8
export const POOL_DUCKS = Object.freeze([
  Object.freeze({ id: 'duck-1', objectIndex: 1, faucetStep: 4, targetStep: 0 }),
  Object.freeze({ id: 'duck-2', objectIndex: 2, faucetStep: 1, targetStep: 3 }),
  Object.freeze({ id: 'duck-3', objectIndex: 3, faucetStep: 7, targetStep: 5 }),
])

function freezeDucks(ducks) {
  return Object.freeze(Object.fromEntries(
    Object.entries(ducks).map(([id, duck]) => [id, Object.freeze(duck)]),
  ))
}

export function createPoolPuzzleState() {
  return Object.freeze({
    ducks: freezeDucks(Object.fromEntries(POOL_DUCKS.map(({ id }) => [id, { step: 0, angle: 0 }]))),
    solved: false,
  })
}

export function rotatePoolDuck(state, duckId) {
  if (state.solved || !state.ducks[duckId]) return state
  const step = (state.ducks[duckId].step + 1) % POOL_DUCK_STEP_COUNT
  const ducks = freezeDucks({
    ...state.ducks,
    [duckId]: { step, angle: step * Math.PI * 2 / POOL_DUCK_STEP_COUNT },
  })
  const solved = POOL_DUCKS.every(({ id, targetStep }) => ducks[id].step === targetStep)
  return Object.freeze({ ducks, solved })
}
