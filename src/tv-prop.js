import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

import {
  TV_ANOMALY_BRIGHTNESS,
  TV_CHANNELS,
  TV_INITIAL_CHANNEL,
  TV_NORMAL_BRIGHTNESS,
  chooseNextTvDisplay,
} from './tv-display.js'

const TV_URL = '/models/interactive/tv-9d401ae2.glb'
const HANDPRINT_URL = '/textures/tv-handprint-b6082550.jpg'
const DISPLAY_WIDTH = 512
const DISPLAY_HEIGHT = 320

function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = DISPLAY_WIDTH
  canvas.height = DISPLAY_HEIGHT
  return canvas
}

function drawCiderAdvertisement(context) {
  const gradient = context.createLinearGradient(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
  gradient.addColorStop(0, '#40130d')
  gradient.addColorStop(1, '#d18a2e')
  context.fillStyle = gradient
  context.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)

  context.fillStyle = '#f4c85b'
  context.beginPath()
  context.arc(118, 148, 66, 0, Math.PI * 2)
  context.arc(171, 148, 66, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#9c2e18'
  context.beginPath()
  context.arc(144, 160, 55, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#442114'
  context.lineWidth = 12
  context.beginPath()
  context.moveTo(148, 104)
  context.quadraticCurveTo(162, 64, 194, 57)
  context.stroke()
  context.fillStyle = '#54733a'
  context.beginPath()
  context.ellipse(196, 72, 28, 13, -.35, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#fff4ce'
  context.font = '700 68px Georgia, serif'
  context.fillText('CIDER', 232, 137)
  context.font = '600 25px Georgia, serif'
  context.fillText('APPLE CELLAR RESERVE', 234, 178)
  context.fillStyle = '#2a120d'
  context.fillRect(218, 211, 264, 61)
  context.fillStyle = '#ffe2a1'
  context.font = '700 34px Georgia, serif'
  context.fillText('4242 5142', 256, 253)
}

function drawColorBars(context) {
  const colors = ['#d8d8d0', '#d9d64b', '#35c9c2', '#45bd58', '#bd49b9', '#c94242', '#3c4fbd']
  const barWidth = DISPLAY_WIDTH / colors.length
  colors.forEach((color, index) => {
    context.fillStyle = color
    context.fillRect(index * barWidth, 0, Math.ceil(barWidth), 224)
  })
  context.fillStyle = '#13151a'
  context.fillRect(0, 224, DISPLAY_WIDTH, 96)
  context.fillStyle = '#e4e4dc'
  context.fillRect(0, 224, 74, 30)
  context.fillStyle = '#42206f'
  context.fillRect(74, 224, 74, 30)
  context.fillStyle = '#161616'
  context.fillRect(148, 224, 216, 30)
  context.fillStyle = '#d9d9cf'
  context.textAlign = 'center'
  context.font = '700 38px Georgia, serif'
  context.fillText('NO SIGNAL', DISPLAY_WIDTH / 2, 294)
  context.textAlign = 'start'
}

function drawBarIdent(context) {
  context.fillStyle = '#071315'
  context.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
  context.strokeStyle = '#c97135'
  context.lineWidth = 5
  context.strokeRect(38, 34, DISPLAY_WIDTH - 76, DISPLAY_HEIGHT - 68)
  context.fillStyle = '#d89b5d'
  context.textAlign = 'center'
  context.font = '700 58px Georgia, serif'
  context.fillText("LITHOS'", DISPLAY_WIDTH / 2, 137)
  context.fillStyle = '#9db5a0'
  context.font = '600 31px Georgia, serif'
  context.fillText('LATE BAR', DISPLAY_WIDTH / 2, 188)
  context.fillStyle = '#798b7c'
  context.font = '20px Georgia, serif'
  context.fillText('CHANNEL 03 · AFTER HOURS', DISPLAY_WIDTH / 2, 239)
  context.textAlign = 'start'
}

function drawHumanPeeler(context) {
  context.fillStyle = '#10251d'
  context.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
  context.fillStyle = '#f0d9a2'
  context.fillRect(24, 22, DISPLAY_WIDTH - 48, DISPLAY_HEIGHT - 44)
  context.strokeStyle = '#28382b'
  context.lineWidth = 7
  context.strokeRect(24, 22, DISPLAY_WIDTH - 48, DISPLAY_HEIGHT - 44)

  context.fillStyle = '#e87524'
  context.beginPath()
  context.moveTo(126, 74)
  context.quadraticCurveTo(82, 178, 134, 258)
  context.quadraticCurveTo(187, 178, 150, 74)
  context.closePath()
  context.fill()
  context.fillStyle = '#42733c'
  context.beginPath()
  context.ellipse(112, 68, 37, 15, -.6, 0, Math.PI * 2)
  context.ellipse(150, 64, 35, 14, .45, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#f5e8c8'
  context.beginPath()
  context.arc(132, 143, 20, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#243128'
  context.beginPath()
  context.arc(136, 144, 9, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f3eee0'
  context.beginPath()
  context.arc(139, 140, 3, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = '#e87524'
  context.lineWidth = 15
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(151, 151)
  context.lineTo(213, 184)
  context.stroke()
  context.strokeStyle = '#33433d'
  context.lineWidth = 12
  context.beginPath()
  context.moveTo(206, 178)
  context.lineTo(246, 202)
  context.stroke()
  context.strokeStyle = '#a9b7ad'
  context.lineWidth = 9
  context.beginPath()
  context.moveTo(238, 195)
  context.lineTo(264, 210)
  context.stroke()

  context.fillStyle = '#22352b'
  context.font = '700 41px Georgia, serif'
  context.fillText('HUMAN', 280, 128)
  context.fillText('PEELER', 270, 176)
  context.font = '600 19px Georgia, serif'
  context.fillText('FOR CARROTS', 283, 219)
  context.fillText('TO PEEL HUMANS', 263, 245)
  context.fillStyle = '#8f321f'
  context.font = '700 22px Georgia, serif'
  context.fillText('666-4514', 320, 274)
}

function drawOptometryScene(context) {
  context.fillStyle = '#030504'
  context.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
  context.save()
  context.beginPath()
  context.arc(DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2, 148, 0, Math.PI * 2)
  context.clip()

  const sky = context.createLinearGradient(0, 12, 0, 175)
  sky.addColorStop(0, '#3185ce')
  sky.addColorStop(1, '#90cbed')
  context.fillStyle = sky
  context.fillRect(100, 0, 312, 174)

  const field = context.createLinearGradient(0, 164, 0, 320)
  field.addColorStop(0, '#6eb44c')
  field.addColorStop(1, '#38852f')
  context.fillStyle = field
  context.fillRect(95, 164, 322, 156)
  context.strokeStyle = 'rgba(31, 91, 37, .72)'
  context.lineWidth = 3
  for (let x = 104; x <= 408; x += 24) {
    context.beginPath()
    context.moveTo(256, 168)
    context.lineTo(x, 320)
    context.stroke()
  }
  context.strokeStyle = 'rgba(156, 201, 91, .48)'
  context.lineWidth = 2
  for (let y = 188; y < 320; y += 18) {
    context.beginPath()
    context.moveTo(100, y)
    context.lineTo(412, y)
    context.stroke()
  }

  context.fillStyle = '#f5f1df'
  context.fillRect(240, 149, 34, 22)
  context.fillStyle = '#d72524'
  context.beginPath()
  context.moveTo(235, 151)
  context.lineTo(257, 133)
  context.lineTo(280, 151)
  context.closePath()
  context.fill()
  context.fillStyle = '#4a392c'
  context.fillRect(254, 158, 7, 13)
  context.restore()
}

async function createChannelTextures() {
  const painters = [drawCiderAdvertisement, drawColorBars, drawBarIdent, drawHumanPeeler, drawOptometryScene]
  const textures = painters.map((paint, index) => {
    const canvas = createCanvas()
    const context = canvas.getContext('2d')
    paint(context)
    const texture = new THREE.CanvasTexture(canvas)
    texture.name = `TV channel ${TV_CHANNELS[index].id}`
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  })
  const textureLoader = new THREE.TextureLoader()
  const anomalyTexture = await textureLoader.loadAsync(HANDPRINT_URL)
  anomalyTexture.name = 'TV handprint static anomaly'
  anomalyTexture.colorSpace = THREE.SRGBColorSpace
  anomalyTexture.anisotropy = 4
  return { textures, anomalyTexture }
}

export async function createTvProp(scene) {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(TV_URL)
  const root = gltf.scene
  root.name = 'Interactive television'
  root.position.set(3.55, 1.62, 1.62)
  root.rotation.y = Math.PI
  scene.add(root)

  const screen = root.getObjectByName('TVScreen')
  if (!screen?.isMesh) throw new Error('Optimized TV is missing TVScreen')
  const importedScreenMaterial = screen.material
  const screenGlass = root.getObjectByName('tvScreenGlass_Glass_0')
  if (screenGlass) screenGlass.visible = false

  const { textures, anomalyTexture } = await createChannelTextures()
  const material = new THREE.MeshStandardMaterial({
    name: 'TV luminous display',
    map: textures[TV_INITIAL_CHANNEL],
    emissive: 0xffffff,
    emissiveMap: textures[TV_INITIAL_CHANNEL],
    emissiveIntensity: TV_NORMAL_BRIGHTNESS,
    roughness: .3,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  screen.material = material
  if (Array.isArray(importedScreenMaterial)) importedScreenMaterial.forEach((item) => item.dispose())
  else importedScreenMaterial?.dispose()

  const occluders = []
  root.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    if (object !== screen) occluders.push(object)
  })
  root.updateMatrixWorld(true)
  const screenBounds = new THREE.Box3().setFromObject(screen)
  const interactionAnchor = new THREE.Object3D()
  interactionAnchor.name = 'TVScreenInteract'
  screenBounds.getCenter(interactionAnchor.position)
  interactionAnchor.position.x -= .035
  scene.add(interactionAnchor)

  let channelIndex = TV_INITIAL_CHANNEL
  let anomalyActive = false
  let anomalyTimer = null
  function showTexture(texture) {
    material.map = texture
    material.emissiveMap = texture
    material.needsUpdate = true
  }
  function setChannel(index) {
    channelIndex = ((index % TV_CHANNELS.length) + TV_CHANNELS.length) % TV_CHANNELS.length
    material.emissiveIntensity = TV_NORMAL_BRIGHTNESS
    showTexture(textures[channelIndex])
  }

  return {
    root,
    screen,
    interactionAnchor,
    occluders,
    cycleChannel() {
      if (anomalyActive) return null
      const nextDisplay = chooseNextTvDisplay(channelIndex, Math.random())
      channelIndex = nextDisplay.channelIndex
      if (!nextDisplay.showAnomaly) {
        setChannel(channelIndex)
        return TV_CHANNELS[channelIndex]
      }
      anomalyActive = true
      material.emissiveIntensity = TV_ANOMALY_BRIGHTNESS
      showTexture(anomalyTexture)
      anomalyTimer = setTimeout(() => {
        anomalyActive = false
        anomalyTimer = null
        setChannel(channelIndex)
      }, 2000)
      return TV_CHANNELS[channelIndex]
    },
    reset() {
      if (anomalyTimer) clearTimeout(anomalyTimer)
      anomalyTimer = null
      anomalyActive = false
      setChannel(TV_INITIAL_CHANNEL)
    },
    dispose() {
      if (anomalyTimer) clearTimeout(anomalyTimer)
      anomalyTimer = null
      root.removeFromParent()
      interactionAnchor.removeFromParent()
      const geometries = new Set()
      const materials = new Set()
      root.traverse((object) => {
        if (object.geometry && !geometries.has(object.geometry)) {
          geometries.add(object.geometry)
          object.geometry.dispose()
        }
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
        objectMaterials.filter(Boolean).forEach((objectMaterial) => {
          if (materials.has(objectMaterial)) return
          materials.add(objectMaterial)
          objectMaterial.dispose()
        })
      })
      new Set([...textures, anomalyTexture]).forEach((texture) => texture.dispose())
    },
    isGlitching: () => anomalyActive,
    getChannelIndex: () => channelIndex,
  }
}