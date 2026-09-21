import assert from 'node:assert/strict'
import test from 'node:test'

import { getInitialScene } from './app-route.js'

test('the /hr2 shortcut starts directly in the horror room', () => {
  assert.equal(getInitialScene('/hr2'), 'horror')
  assert.equal(getInitialScene('/hr2/'), 'horror')
})

test('the /hr3 shortcut starts in the horror room with the pool completed', () => {
  assert.equal(getInitialScene('/hr3'), 'horror-after-pool')
  assert.equal(getInitialScene('/hr3/'), 'horror-after-pool')
})

test('the /yog shortcut starts inside the survived library elevator', () => {
  assert.equal(getInitialScene('/yog'), 'library-after-survival')
  assert.equal(getInitialScene('/yog/'), 'library-after-survival')
})

test('all other paths start in the bar', () => {
  assert.equal(getInitialScene('/'), 'bar')
  assert.equal(getInitialScene('/anything-else'), 'bar')
})
