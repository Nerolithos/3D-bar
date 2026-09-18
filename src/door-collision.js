export const ROOM_DOOR_Z = -2.72
export const DOORWAY_MIN_X = -2.53
export const DOORWAY_MAX_X = -1.17
export const DOOR_THRESHOLD_Z = -2.82
export const DOOR_COLLISION_RADIUS = 0.2

function isInsideDoorway(x) {
  return x >= DOORWAY_MIN_X + DOOR_COLLISION_RADIUS && x <= DOORWAY_MAX_X - DOOR_COLLISION_RADIUS
}

export function resolveBarBoundaryMove(start, candidate, doorOpen) {
  const stopZ = ROOM_DOOR_Z + DOOR_COLLISION_RADIUS
  if (candidate.z >= stopZ) return { ...candidate }
  if (doorOpen && isInsideDoorway(candidate.x)) return { ...candidate }
  return { ...candidate, z: stopZ }
}

export function crossedDoorThreshold(position) {
  return position.z < DOOR_THRESHOLD_Z && isInsideDoorway(position.x)
}