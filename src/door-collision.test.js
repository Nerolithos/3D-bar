import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOOR_COLLISION_RADIUS,
  DOORWAY_MAX_X,
  DOORWAY_MIN_X,
  ROOM_DOOR_Z,
  crossedDoorThreshold,
  resolveBarBoundaryMove,
} from './door-collision.js'

test('closed door clamps movement at the back wall', () => {
  const start = { x: -1.85, z: ROOM_DOOR_Z + 0.1 }
  assert.deepEqual(resolveBarBoundaryMove(start, { x: -1.85, z: ROOM_DOOR_Z - 0.2 }, false), {
    x: -1.85,
    z: ROOM_DOOR_Z + DOOR_COLLISION_RADIUS,
  })
})

test('open door permits crossing only through the doorway span', () => {
  const start = { x: -1.85, z: ROOM_DOOR_Z + 0.1 }
  const throughDoor = { x: -1.85, z: ROOM_DOOR_Z - 0.2 }
  assert.deepEqual(resolveBarBoundaryMove(start, throughDoor, true), throughDoor)

  const leftOfDoor = { x: DOORWAY_MIN_X - 0.01, z: ROOM_DOOR_Z - 0.2 }
  assert.equal(resolveBarBoundaryMove(start, leftOfDoor, true).z, ROOM_DOOR_Z + DOOR_COLLISION_RADIUS)
  const rightOfDoor = { x: DOORWAY_MAX_X + 0.01, z: ROOM_DOOR_Z - 0.2 }
  assert.equal(resolveBarBoundaryMove(start, rightOfDoor, true).z, ROOM_DOOR_Z + DOOR_COLLISION_RADIUS)
})

test('open doorway keeps the player body clear of both frame uprights', () => {
  const start = { x: -1.85, z: ROOM_DOOR_Z + 0.1 }
  const clipsLeftFrame = { x: DOORWAY_MIN_X + DOOR_COLLISION_RADIUS - 0.01, z: ROOM_DOOR_Z - 0.2 }
  const clipsRightFrame = { x: DOORWAY_MAX_X - DOOR_COLLISION_RADIUS + 0.01, z: ROOM_DOOR_Z - 0.2 }

  assert.equal(resolveBarBoundaryMove(start, clipsLeftFrame, true).z, ROOM_DOOR_Z + DOOR_COLLISION_RADIUS)
  assert.equal(resolveBarBoundaryMove(start, clipsRightFrame, true).z, ROOM_DOOR_Z + DOOR_COLLISION_RADIUS)
})

test('threshold crossing begins only beyond the open doorway', () => {
  assert.equal(crossedDoorThreshold({ x: -1.85, z: ROOM_DOOR_Z }), false)
  assert.equal(crossedDoorThreshold({ x: -1.85, z: ROOM_DOOR_Z - 0.11 }), true)
  assert.equal(crossedDoorThreshold({ x: DOORWAY_MAX_X + 0.1, z: ROOM_DOOR_Z - 0.11 }), false)
})