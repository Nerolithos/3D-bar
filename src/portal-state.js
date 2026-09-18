export const PORTALS = Object.freeze([
  Object.freeze({
    id: 'pool-01',
    screenName: 'CRTScreen_06',
    label: '泳池空间',
    modelUrl: '/models/pool_room_v001-36cdbf4e.glb',
    previewUrl: '/textures/pool-portal-preview-7dea476f.jpg',
    oneWay: true,
  }),
])

const VALID_STATUSES = new Set([
  'locked',
  'unlocked',
  'loading',
  'ready',
  'error',
  'entering',
  'completed',
])

export function createPortalState() {
  return Object.fromEntries(PORTALS.map(({ id }) => [id, { status: 'locked', error: null }]))
}

function updatePortal(state, portalId, nextStatus, error = null) {
  if (!VALID_STATUSES.has(nextStatus)) throw new RangeError('Unknown portal status')
  const current = state[portalId]
  if (!current) throw new RangeError(`Unknown portal: ${portalId}`)
  if (current.status === nextStatus && current.error === error) return state
  return { ...state, [portalId]: { status: nextStatus, error } }
}

export function unlockPortal(state, portalId) {
  return state[portalId]?.status === 'locked' ? updatePortal(state, portalId, 'unlocked') : state
}

export function requestPortalPreload(state, portalId) {
  const status = state[portalId]?.status
  return status === 'unlocked' || status === 'error'
    ? updatePortal(state, portalId, 'loading')
    : state
}

export function resolvePortalPreload(state, portalId) {
  return state[portalId]?.status === 'loading' ? updatePortal(state, portalId, 'ready') : state
}

export function failPortalPreload(state, portalId, error) {
  return state[portalId]?.status === 'loading'
    ? updatePortal(state, portalId, 'error', String(error || 'load failed'))
    : state
}

export function beginPortalEntry(state, portalId) {
  return state[portalId]?.status === 'ready' ? updatePortal(state, portalId, 'entering') : state
}

export function finishPortalEntry(state, portalId) {
  return state[portalId]?.status === 'entering' ? updatePortal(state, portalId, 'completed') : state
}
