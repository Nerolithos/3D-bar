import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TV_ANOMALY_BRIGHTNESS,
  TV_CHANNELS,
  TV_NORMAL_BRIGHTNESS,
  chooseNextTvDisplay,
  nextTvChannel,
} from './tv-display.js'

test('TV channels cycle through all four displays', () => {
  assert.deepEqual(TV_CHANNELS.map((channel) => channel.id), [
    'cider',
    'static',
    'bar-ident',
    'human-peeler',
  ])
  assert.equal(TV_CHANNELS[0].label, 'CIDER · 4242 5142')
  assert.equal(nextTvChannel(0), 1)
  assert.equal(nextTvChannel(1), 2)
  assert.equal(nextTvChannel(2), 3)
  assert.equal(nextTvChannel(3), 0)
})

test('TV anomaly preserves the next normal channel and uses a twenty percent boundary', () => {
  assert.deepEqual(chooseNextTvDisplay(1, .19), {
    channelIndex: 2,
    showAnomaly: true,
  })
  assert.deepEqual(chooseNextTvDisplay(1, .2), {
    channelIndex: 2,
    showAnomaly: false,
  })
})

test('TV anomaly doubles the normal screen brightness', () => {
  assert.equal(TV_NORMAL_BRIGHTNESS, 2.7)
  assert.equal(TV_ANOMALY_BRIGHTNESS, 5.4)
})
