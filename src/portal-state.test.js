import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PORTALS,
  beginPortalEntry,
  createPortalState,
  failPortalPreload,
  finishPortalEntry,
  requestPortalPreload,
  reopenPortal,
  resolvePortalPreload,
  unlockPortal,
} from './portal-state.js'

test('pool television uses a stable portal id and begins locked', () => {
  assert.equal(PORTALS[0].id, 'pool-01')
  assert.equal(PORTALS[0].screenName, 'CRTScreen_06')
  assert.equal(createPortalState()['pool-01'].status, 'locked')
})

test('pool portal follows locked, preload, ready, entering and completed states', () => {
  const locked = createPortalState()
  const unlocked = unlockPortal(locked, 'pool-01')
  const loading = requestPortalPreload(unlocked, 'pool-01')
  const ready = resolvePortalPreload(loading, 'pool-01')
  const entering = beginPortalEntry(ready, 'pool-01')
  const completed = finishPortalEntry(entering, 'pool-01')

  assert.equal(unlocked['pool-01'].status, 'unlocked')
  assert.equal(loading['pool-01'].status, 'loading')
  assert.equal(ready['pool-01'].status, 'ready')
  assert.equal(entering['pool-01'].status, 'entering')
  assert.equal(completed['pool-01'].status, 'completed')
  assert.strictEqual(requestPortalPreload(loading, 'pool-01'), loading)
  assert.strictEqual(beginPortalEntry(entering, 'pool-01'), entering)
  assert.equal(reopenPortal(completed, 'pool-01')['pool-01'].status, 'ready')
})

test('failed pool preload is visible and retryable', () => {
  const loading = requestPortalPreload(unlockPortal(createPortalState(), 'pool-01'), 'pool-01')
  const failed = failPortalPreload(loading, 'pool-01', 'network')
  const retry = requestPortalPreload(failed, 'pool-01')

  assert.equal(failed['pool-01'].status, 'error')
  assert.equal(failed['pool-01'].error, 'network')
  assert.equal(retry['pool-01'].status, 'loading')
  assert.equal(retry['pool-01'].error, null)
})
