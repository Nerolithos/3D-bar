import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

import {
  TV_ANOMALY_BRIGHTNESS,
  TV_CHANNELS,
  TV_NORMAL_BRIGHTNESS,
  chooseNextTvDisplay,
} from './tv-display.js'

const TV_URL = '/models/interactive/tv-9d401ae2.glb'
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

function drawHandprintStatic(context) {
  const glow = context.createRadialGradient(275, 155, 18, 275, 155, 310)
  glow.addColorStop(0, '#eafcff')
  glow.addColorStop(.38, '#b9e8f4')
  glow.addColorStop(.72, '#5b9db5')
  glow.addColorStop(1, '#193746')
  context.fillStyle = glow
  context.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
  for (let y = 0; y < DISPLAY_HEIGHT; y += 4) {
    for (let x = 0; x < DISPLAY_WIDTH; x += 4) {
      const value = 18 + ((x * 19 + y * 31 + (x ^ y) * 11) % 54)
      context.fillStyle = `rgba(${value},${value + 15},${value + 22},.2)`
      context.fillRect(x, y, 3, 3)
    }
  }
  context.fillStyle = 'rgba(8, 25, 37, .13)'
  for (let y = 7; y < DISPLAY_HEIGHT; y += 11) context.fillRect(0, y, DISPLAY_WIDTH, 2)

  const fingers = [
    [-62, -38, 17, 67, -.2],
    [-31, -70, 18, 82, -.1],
    [3, -79, 19, 88, 0],
    [38, -65, 18, 80, .12],
    [72, -35, 16, 66, .34],
  ]
  for (const [blur, alpha, scale] of [[20, .12, 1.1], [10, .24, 1.04], [3, .83, 1]]) {
    context.save()
    context.translate(278, 178)
    context.rotate(-.15)
    context.scale(scale, scale)
    context.filter = `blur(${blur}px)`
    context.fillStyle = `rgba(2, 28, 68, ${alpha})`
    context.beginPath()
    context.ellipse(0, 35, 69, 78, 0, 0, Math.PI * 2)
    context.fill()
    for (const [x, y, radiusX, radiusY, rotation] of fingers) {
      context.beginPath()
      context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  }
}

function createChannelTextures() {
  const painters = [drawCiderAdvertisement, drawColorBars, drawBarIdent, drawHumanPeeler]
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
  const anomalyCanvas = createCanvas()
  drawHandprintStatic(anomalyCanvas.getContext('2d'))
  const anomalyTexture = new THREE.CanvasTexture(anomalyCanvas)
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

  const { textures, anomalyTexture } = createChannelTextures()
  const material = new THREE.MeshStandardMaterial({
    name: 'TV luminous display',
    map: textures[0],
    emissive: 0xffffff,
    emissiveMap: textures[0],
    emissiveIntensity: TV_NORMAL_BRIGHTNESS,
    roughness: .3,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  screen.material = material

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

  let channelIndex = 0
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
      setChannel(0)
    },
    isGlitching: () => anomalyActive,
    getChannelIndex: () => channelIndex,
  }
}