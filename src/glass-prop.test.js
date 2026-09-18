import assert from 'node:assert/strict'
import test from 'node:test'

import { createCiderLabelModel } from './glass-prop.js'

test('door hint is only the CIDER glyphs without a paper card', () => {
  const label = createCiderLabelModel()

  assert.equal(label.name, 'CIDER door label')
  assert.equal(label.children.length, 5)
  assert.ok(label.children.every((letter) => letter.isGroup))
})