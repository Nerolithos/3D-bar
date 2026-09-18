import { disposeObjectTree } from './scene-lifecycle.js'

export function createPortalLifecycle({ scene, loadPortal }) {
  const loadPromises = new Map()
  const roots = new Map()
  let currentRoots = []
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
    transition(portalId, { clearCollections = [] } = {}) {
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
        disposeObjectTree(root, disposedResources)
      })
      currentRoots = []
      clearCollections.forEach((collection) => { collection.length = 0 })
      nextRoot.visible = true
      scene.add(nextRoot)
      return true
    },
  }
}

