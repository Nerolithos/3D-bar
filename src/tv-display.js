export const TV_CHANNELS = Object.freeze([
  Object.freeze({ id: 'cider', label: 'CIDER · 4242 5142' }),
  Object.freeze({ id: 'static', label: 'NO SIGNAL' }),
  Object.freeze({ id: 'bar-ident', label: "LITHOS' LATE BAR" }),
  Object.freeze({ id: 'human-peeler', label: 'HUMAN PEELER' }),
  Object.freeze({ id: 'optometry-scene', label: 'FIELD VIEW' }),
])

export const TV_NORMAL_BRIGHTNESS = 2.7
export const TV_ANOMALY_BRIGHTNESS = 7.2
export const TV_INITIAL_CHANNEL = 1

export function nextTvChannel(index) {
  return (index + 1) % TV_CHANNELS.length
}

export function chooseNextTvDisplay(index, randomValue) {
  return {
    channelIndex: nextTvChannel(index),
    showAnomaly: randomValue < .2,
  }
}