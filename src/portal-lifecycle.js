import { disposeObjectTree } from './scene-lifecycle.js'

export function createPortalLifecycle({ scene, loadPortal }) {
  const loadPromises = new Map()
  const roots = new Map()
  let currentRoots = []
  let preservedRoots = []
  let activePortalId = null
  let transitioned = false

  return {
    preload(portalId, onProgress) {
      if (loadPromises.has(portalId)) return loadPromises.get(portalId)
      const promise = Promise.resolve()
        .then(() => loadPortal(portalId, onProgress))
        .then((root) => {
          root.visible = false
          roots.set(portalId, root)
          return root
        })
        .catch((error) => {
          loadPromises.delete(portalId)
          throw error
        })
      loadPromises.set(portalId, promise)
      return promise
    },
    setCurrentRoots(nextRoots) {
      currentRoots = nextRoots.filter(Boolean)
    },
    getRoot(portalId) {
      return roots.get(portalId) ?? null
    },
    transition(portalId, { clearCollections = [], preserveCurrent = false } = {}) {
      const nextRoot = roots.get(portalId)
      if (transitioned || !nextRoot) return false
      transitioned = true
      const disposedResources = {
        geometries: new Set(),
        materials: new Set(),
        textures: new Set(),
      }
      currentRoots.forEach((root) => {
        scene.remove(root)
        root.removeFromParent?.()
        if (preserveCurrent) root.visible = false
        else disposeObjectTree(root, disposedResources)
      })
      preservedRoots = preserveCurrent ? [...currentRoots] : []
      currentRoots = []
      clearCollections.forEach((collection) => { collection.length = 0 })
      nextRoot.visible = true
      scene.add(nextRoot)
      activePortalId = portalId
      return true
    },
    returnToPrevious({ clearCollections = [] } = {}) {
      if (!transitioned || !preservedRoots.length || !activePortalId) return false
      const activeRoot = roots.get(activePortalId)
      if (activeRoot) {
        scene.remove(activeRoot)
        activeRoot.removeFromParent?.()
        activeRoot.visible = false
      }
      preservedRoots.forEach((root) => {
        root.visible = true
        scene.add(root)
      })
      currentRoots = [...preservedRoots]
      preservedRoots = []
      clearCollections.forEach((collection) => { collection.length = 0 })
      activePortalId = null
      transitioned = false
      return true
    },
  }
}
