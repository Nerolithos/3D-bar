export const PORTALS = Object.freeze([
  Object.freeze({
    id: 'pool-01',
    screenName: 'CRTScreen_06',
    label: '泳池空间',
    modelUrl: '/models/pool_room_v001-2ee22a73.glb',
    previewUrl: '/textures/pool-portal-dagon-deac052c.jpg',
    oneWay: false,
  }),
  Object.freeze({
    id: 'library-02',
    screenName: 'CRTScreen_07',
    label: 'Yog-Sothoth 图书馆',
    modelUrl: '/models/elevator-b6e14779.glb',
    bookshelfUrl: '/models/bookshelf-1651bc85.glb',
    ceilingUrl: '/models/ceiling-ab0e0502.glb',
    eyeUrl: '/textures/library-eye-4e4953f6.webp',
    previewUrl: '/textures/portal-yog-sothoth-78d62693.jpg',
    oneWay: false,
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

export function reopenPortal(state, portalId) {
  return state[portalId]?.status === 'completed' ? updatePortal(state, portalId, 'ready') : state
}
