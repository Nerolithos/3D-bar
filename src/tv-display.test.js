import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TV_ANOMALY_BRIGHTNESS,
  TV_CHANNELS,
  TV_INITIAL_CHANNEL,
  TV_NORMAL_BRIGHTNESS,
  chooseNextTvDisplay,
  nextTvChannel,
} from './tv-display.js'

test('TV channels cycle through all five displays', () => {
  assert.deepEqual(TV_CHANNELS.map((channel) => channel.id), [
    'cider',
    'static',
    'bar-ident',
    'human-peeler',
    'optometry-scene',
  ])
  assert.equal(TV_CHANNELS[0].label, 'CIDER · 4242 5142')
  assert.equal(nextTvChannel(0), 1)
  assert.equal(nextTvChannel(1), 2)
  assert.equal(nextTvChannel(2), 3)
  assert.equal(nextTvChannel(3), 4)
  assert.equal(nextTvChannel(4), 0)
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

test('TV anomaly is substantially brighter than the normal screen', () => {
  assert.equal(TV_NORMAL_BRIGHTNESS, 2.7)
  assert.equal(TV_ANOMALY_BRIGHTNESS, 7.2)
})

test('TV starts on the NO SIGNAL channel', () => {
  assert.equal(TV_INITIAL_CHANNEL, 1)
  assert.equal(TV_CHANNELS[TV_INITIAL_CHANNEL].id, 'static')
})
