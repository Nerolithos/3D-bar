import { isDoorReadyToOpen } from './game-state.js'

function disposeMaterial(material, disposedTextures) {
  for (const value of Object.values(material)) {
    if (value?.isTexture && !disposedTextures.has(value)) {
      disposedTextures.add(value)
      value.dispose()
    }
  }
  material.dispose()
}

export function disposeObjectTree(root, resources = {}) {
  const disposedGeometries = resources.geometries ?? new Set()
  const disposedMaterials = resources.materials ?? new Set()
  const disposedTextures = resources.textures ?? new Set()
  root.traverse((object) => {
    if (object.geometry && !disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry)
      object.geometry.dispose()
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach((material) => {
      if (disposedMaterials.has(material)) return
      disposedMaterials.add(material)
      disposeMaterial(material, disposedTextures)
    })
  })
}

export function createSceneLifecycle({ scene, loadHorrorRoom }) {
  let loadPromise = null
  let horrorRoot = null
  let barRoots = []
  let transitioned = false

  return {
    preload(onProgress) {
      if (loadPromise) return loadPromise
      loadPromise = Promise.resolve()
        .then(() => loadHorrorRoom(onProgress))
        .then((root) => {
          horrorRoot = root
          horrorRoot.visible = false
          return horrorRoot
        })
        .catch((error) => {
          loadPromise = null
          throw error
        })
      return loadPromise
    },
    setBarRoots(roots) {
      barRoots = roots.filter(Boolean)
    },
    getBarRoots() {
      return [...barRoots]
    },
    getHorrorRoot() {
      return horrorRoot
    },
    canOpen(state) {
      return Boolean(horrorRoot) && isDoorReadyToOpen(state)
    },
    activate({ clearCollections = [] } = {}) {
      if (transitioned || !horrorRoot) return false
      transitioned = true
      const disposedResources = {
        geometries: new Set(),
        materials: new Set(),
        textures: new Set(),
      }
      barRoots.forEach((root) => {
        scene.remove(root)
        root.removeFromParent?.()
        disposeObjectTree(root, disposedResources)
      })
      barRoots = []
      clearCollections.forEach((collection) => { collection.length = 0 })
      horrorRoot.visible = true
      scene.add(horrorRoot)
      return true
    },
    transition(state, options) {
      if (!this.canOpen(state)) return false
      return this.activate(options)
    },
  }
}