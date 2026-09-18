import assert from 'node:assert/strict'
import test from 'node:test'

import { getPortalScreenVisual } from './portal-screen.js'

test('pool portal screen has distinct loading, ready, error and completed visuals', () => {
  const states = ['loading', 'ready', 'error', 'completed'].map(getPortalScreenVisual)
  assert.equal(new Set(states.map(({ intensity }) => intensity)).size, states.length)
  assert.notEqual(states[1].color, states[2].color)
  assert.equal(states[3].intensity, 0)
})
