import assert from 'node:assert/strict'
import test from 'node:test'

import { getInitialScene } from './app-route.js'

test('the /hr2 shortcut starts directly in the horror room', () => {
  assert.equal(getInitialScene('/hr2'), 'horror')
  assert.equal(getInitialScene('/hr2/'), 'horror')
})

test('all other paths start in the bar', () => {
  assert.equal(getInitialScene('/'), 'bar')
  assert.equal(getInitialScene('/anything-else'), 'bar')
})