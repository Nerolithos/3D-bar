import assert from 'node:assert/strict'
import test from 'node:test'

import { DOOR_SYMBOLS } from './game-state.js'
import { createDoorKeypadMarkup } from './door-keypad.js'

test('door keypad renders eight slots and ten unique abstract symbols without digits', () => {
  const markup = createDoorKeypadMarkup(DOOR_SYMBOLS)
  const slots = [...markup.matchAll(/data-door-slot/g)]
  const symbols = [...markup.matchAll(/data-symbol="([^"]+)"/g)].map((match) => match[1])

  assert.equal(slots.length, 8)
  assert.equal(symbols.length, 10)
  assert.equal(new Set(symbols).size, 10)
  assert.equal(/data-digit|>\s*\d\s*</.test(markup), false)
})