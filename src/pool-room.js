import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import {
  advancePoolElectricalState,
  createPoolElectricalState,
  resetPoolElectricalAfterDeath,
  startPoolElectricalSequence,
  unlockSecondPoolTelevision,
} from './pool-electrical.js'
import { POOL_DUCKS, createPoolPuzzleState, rotatePoolDuck } from './pool-puzzle.js'

export const POOL_BOUNDS = Object.freeze({ minX: -5.05, maxX: 5.05, minZ: -7.05, maxZ: 7.05 })
export const POOL_COLUMN_RADIUS = 1.12
const FULL_LADDER_SCALE = 1.73

export function resolveShortestAngle(current, target) {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

export function samplePoolWaveHeight(x, z, time) {
  const wave = (dx, dz, amplitude, wavelength, speed) => {
    const length = Math.hypot(dx, dz)
    const phase = Math.PI * 2 / wavelength * (x * dx / length + z * dz / length) - speed * time
    return amplitude * Math.sin(phase)
  }
  return wave(1, .28, .075, 3.8, 1.35) +
    wave(-.35, 1, .046, 2.15, 1.72) +
    wave(.72, -.7, .025, 1.08, 2.35)
}

export function resolvePoolMove(position, previous = position) {
  const next = {
    x: THREE.MathUtils.clamp(position.x, POOL_BOUNDS.minX, POOL_BOUNDS.maxX),
    z: THREE.MathUtils.clamp(position.z, POOL_BOUNDS.minZ, POOL_BOUNDS.maxZ),
  }
  const distance = Math.hypot(next.x, next.z)
  if (distance < POOL_COLUMN_RADIUS) {
    const fallbackLength = Math.hypot(previous.x, previous.z)
    const directionX = distance > .001 ? next.x / distance : fallbackLength > .001 ? previous.x / fallbackLength : 1
    const directionZ = distance > .001 ? next.z / distance : fallbackLength > .001 ? previous.z / fallbackLength : 0
    next.x = directionX * POOL_COLUMN_RADIUS
    next.z = directionZ * POOL_COLUMN_RADIUS
  }
  return next
}

export function createPoolWaterMaterial() {
  return new THREE.ShaderMaterial({
    name: 'Animated pool water',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      shallowColor: { value: new THREE.Color(0x62d5d2) },
      deepColor: { value: new THREE.Color(0x063a4b) },
      skyColor: { value: new THREE.Color(0xb8edf0) },
      electricIntensity: { value: 0 },
    },
    vertexShader: `
      uniform float time;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vWaveHeight;

      void gerstnerWave(
        vec2 direction,
        float amplitude,
        float wavelength,
        float speed,
        inout vec3 p,
        inout vec2 slope
      ) {
        direction = normalize(direction);
        float k = 6.28318530718 / wavelength;
        float phase = k * dot(direction, p.xz) - speed * time;
        float sine = sin(phase);
        float cosine = cos(phase);
        p.xz += direction * amplitude * .62 * cosine;
        p.y += amplitude * sine;
        slope += direction * amplitude * k * cosine;
      }

      void main() {
        vec3 p = position;
        float baseHeight = p.y;
        vec2 slope = vec2(0.0);
        gerstnerWave(vec2(1.0, .28), .075, 3.8, 1.35, p, slope);
        gerstnerWave(vec2(-.35, 1.0), .046, 2.15, 1.72, p, slope);
        gerstnerWave(vec2(.72, -.7), .025, 1.08, 2.35, p, slope);
        vec3 localNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
        vWaveHeight = p.y - baseHeight;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 shallowColor;
      uniform vec3 deepColor;
      uniform vec3 skyColor;
      uniform float electricIntensity;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vWaveHeight;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float electricFbm(vec2 p) {
        float value = 0.0;
        float amplitude = .5;
        for (int octave = 0; octave < 4; octave++) {
          value += valueNoise(p) * amplitude;
          p = p * 2.03 + vec2(7.1, 3.7);
          amplitude *= .5;
        }
        return value;
      }

      mat2 rotation2d(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine);
      }

      float lightningArc(vec2 worldPosition, float seed) {
        float frame = floor(time * 11.0 + seed * 17.0);
        vec2 randomPair = vec2(
          hash21(vec2(frame, seed)),
          hash21(vec2(seed + 9.4, frame + 3.7))
        );
        vec2 center = (randomPair - .5) * vec2(7.8, 10.8);
        float angle = (hash21(vec2(frame + 11.0, seed)) - .5) * 6.2831853;
        vec2 p = rotation2d(angle) * (worldPosition - center);
        float coarseBend = (electricFbm(vec2(p.x * .72 + seed * 4.1, frame * .071)) - .5) * 1.55;
        float sharpJitter = (valueNoise(vec2(p.x * 3.8 - seed, frame * .19)) - .5) * .38;
        float path = coarseBend + sharpJitter;
        float trunkDistance = abs(p.y - path);
        float trunk = 1.0 - smoothstep(.018, .105, trunkDistance);
        float lengthMask = 1.0 - smoothstep(2.8, 4.9, abs(p.x));

        float branchOrigin = (hash21(vec2(frame, seed + 22.0)) - .5) * 2.4;
        float branchDirection = hash21(vec2(seed + 4.0, frame)) > .5 ? 1.0 : -1.0;
        float branchX = p.x - branchOrigin;
        float branchPath = path + branchDirection * branchX * .52 +
          (valueNoise(vec2(branchX * 4.6, frame * .23 + seed)) - .5) * .3;
        float branch = 1.0 - smoothstep(.015, .085, abs(p.y - branchPath));
        branch *= smoothstep(0.0, .22, branchX) * (1.0 - smoothstep(1.35, 2.75, branchX));

        float flicker = step(.38, hash21(vec2(frame, seed * 31.0)));
        float microFlicker = .58 + .42 * step(.22, hash21(vec2(floor(time * 37.0), seed)));
        return (trunk + branch * .72) * lengthMask * flicker * microFlicker;
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.2);
        vec3 lightDirection = normalize(vec3(-.32, .9, .24));
        vec3 halfDirection = normalize(lightDirection + viewDirection);
        float specular = pow(max(dot(normal, halfDirection), 0.0), 92.0);
        float causticA = sin(vWorldPosition.x * 4.2 + time * 1.3) * sin(vWorldPosition.z * 3.7 - time);
        float causticB = sin((vWorldPosition.x + vWorldPosition.z) * 6.4 - time * 1.8);
        float caustics = smoothstep(.28, .92, causticA * .65 + causticB * .35);
        float crest = smoothstep(.025, .12, vWaveHeight);
        vec3 color = mix(deepColor, shallowColor, .57 + caustics * .12 + crest * .1);
        color = mix(color, skyColor, fresnel * .68);
        color += vec3(.82, .98, 1.0) * specular * 1.7;
        vec2 electricPosition = vWorldPosition.xz;
        float electricity = lightningArc(electricPosition, .17) +
          lightningArc(electricPosition, 1.93) +
          lightningArc(electricPosition, 4.71);
        float electricCore = clamp(electricity, 0.0, 1.0);
        float electricHalo = pow(clamp(electricity, 0.0, 1.5), .36) * .42;
        color += vec3(.38, .93, 1.28) * (electricCore * 2.4 + electricHalo) * electricIntensity;
        gl_FragColor = vec4(color, .74 + fresnel * .16);
      }
    `,
  })
}

export function isPoolInteractionOccluder(object) {
  if (!object?.isMesh || object.userData.ignoreInteractionOcclusion) return false
  const materials = Array.isArray(object.material) ? object.material : [object.material]
  const labels = [object.name, ...materials.map((material) => material?.name ?? '')].join(' ')
  return !/water/i.test(labels)
}

export function createPoolCausticsMaterial() {
  return new THREE.ShaderMaterial({
    name: 'Animated window pool-floor caustics',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vWorldPosition;
      void main() {
        vec2 p = vWorldPosition.xz;
        vec2 firstWindow = p - vec2(-3.3, -5.15);
        vec2 secondWindow = p - vec2(3.3, -5.15);
        float firstPool = exp(-(firstWindow.x * firstWindow.x * .42 + firstWindow.y * firstWindow.y * .075));
        float secondPool = exp(-(secondWindow.x * secondWindow.x * .42 + secondWindow.y * secondWindow.y * .075));
        float windowMask = clamp(firstPool + secondPool, 0.0, 1.0);
        vec2 q = p * 3.15;
        q += vec2(
          sin(p.y * 2.3 - time * 1.25),
          sin(p.x * 2.05 + time * 1.08)
        ) * .34;
        float field = sin(q.x + time * .8) + sin(q.y - time * .72) + sin((q.x + q.y) * .63 + time * .48);
        float caustic = pow(1.0 - min(abs(field) * .34, 1.0), 7.0);
        float shimmer = .72 + .28 * sin(p.x * 5.2 - p.y * 4.7 + time * 2.1);
        gl_FragColor = vec4(vec3(.48, .98, 1.0), caustic * shimmer * windowMask * .34);
      }
    `,
  })
}

const clearMirrorShader = {
  name: 'Clear pool ceiling mirror shader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    texelSize: { value: new THREE.Vector2(1 / 256, 1 / 256) },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec2 texelSize;
    varying vec4 vUv;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec2 stepSize = texelSize * .45;
      vec3 reflection = texture2D(tDiffuse, uv).rgb * .68;
      reflection += texture2D(tDiffuse, uv + vec2(stepSize.x, 0.0)).rgb * .08;
      reflection += texture2D(tDiffuse, uv - vec2(stepSize.x, 0.0)).rgb * .08;
      reflection += texture2D(tDiffuse, uv + vec2(0.0, stepSize.y)).rgb * .08;
      reflection += texture2D(tDiffuse, uv - vec2(0.0, stepSize.y)).rgb * .08;
      gl_FragColor = vec4(mix(reflection, color, .055), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

function createPoolPuzzleLadder() {
  const ladder = new THREE.Group()
  ladder.name = 'Pool puzzle half-height ladder'
  ladder.position.set(-3.75, -1.21, .2)
  ladder.scale.y = .001
  ladder.visible = false
  const metal = new THREE.MeshStandardMaterial({
    name: 'Shared brushed ladder metal',
    color: 0xd1dcdd,
    emissive: 0x10191a,
    emissiveIntensity: .32,
    metalness: .58,
    roughness: .2,
  })
  const railGeometry = new THREE.CylinderGeometry(.055, .055, 4.15, 10)
  const rungGeometry = new THREE.CylinderGeometry(.043, .043, .66, 10)
  for (const x of [-.3, .3]) {
    const rail = new THREE.Mesh(railGeometry, metal)
    rail.position.set(x, 2.075, 0)
    rail.castShadow = true
    ladder.add(rail)
  }
  for (let index = 0; index < 9; index += 1) {
    const rung = new THREE.Mesh(rungGeometry, metal)
    rung.rotation.z = Math.PI / 2
    rung.position.y = .34 + index * .45
    rung.castShadow = true
    ladder.add(rung)
  }
  return ladder
}

function createPoolElectricalTelevision(root, sourceRoot) {
  const televisionModel = sourceRoot?.clone(true) ?? new THREE.Group()
  televisionModel.name = 'Submerged electrical television model'
  const television = new THREE.Group()
  television.name = 'Submerged electrical television'
  television.position.set(-3.6, -1.1, 5.75)
  const televisionBank = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(24),
  )
  const televisionYaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 2,
  )
  const televisionLean = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(13),
  )
  television.quaternion.copy(televisionLean).multiply(televisionBank).multiply(televisionYaw)
  television.scale.setScalar(2.2)
  television.add(televisionModel)
  television.traverse((object) => {
    if (object.isMesh) object.userData.ignoreInteractionOcclusion = true
  })
  root.add(television)

  const screen = television.getObjectByName('TVScreen')
  const glass = television.getObjectByName('tvScreenGlass_Glass_0')
  if (glass) glass.visible = false
  let screenContext = null
  let screenTexture = null
  if (screen?.isMesh && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 160
    screenContext = canvas.getContext('2d')
    screenTexture = new THREE.CanvasTexture(canvas)
    screenTexture.colorSpace = THREE.SRGBColorSpace
    screen.material = new THREE.MeshStandardMaterial({
      name: 'Pool countdown television screen',
      map: screenTexture,
      emissiveMap: screenTexture,
      emissive: 0xff0000,
      emissiveIntensity: 5.5,
      roughness: .35,
      side: THREE.DoubleSide,
    })
  }

  const powerControl = television.getObjectByName('tvDial') ??
    television.getObjectByName('tvKnobs') ?? television
  television.updateMatrixWorld(true)
  const powerAnchor = new THREE.Object3D()
  powerAnchor.name = 'Pool television power control'
  powerControl.getWorldPosition(powerAnchor.position)
  root.worldToLocal(powerAnchor.position)
  root.add(powerAnchor)

  const interactionBounds = new THREE.Box3().setFromObject(television)
  const interactionAnchor = new THREE.Object3D()
  interactionAnchor.name = 'Whole pool television interaction anchor'
  interactionBounds.getCenter(interactionAnchor.position)
  root.worldToLocal(interactionAnchor.position)
  root.add(interactionAnchor)
  const interactionSize = interactionBounds.getSize(new THREE.Vector3()).addScalar(.42)
  interactionSize.set(
    Math.max(interactionSize.x, 2.8),
    Math.max(interactionSize.y, 2.4),
    Math.max(interactionSize.z, 1.8),
  )

  const smokeGroup = new THREE.Group()
  smokeGroup.name = 'Pool television smoke'
  smokeGroup.position.set(-3.6, -.14, 6.2)
  const smokeData = new Uint8Array(32 * 32 * 4)
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const offset = (y * 32 + x) * 4
      const distance = Math.hypot(x / 15.5 - 1, y / 15.5 - 1)
      smokeData[offset] = 150
      smokeData[offset + 1] = 160
      smokeData[offset + 2] = 164
      smokeData[offset + 3] = Math.round(Math.max(0, 1 - distance) ** 2 * 180)
    }
  }
  const smokeTexture = new THREE.DataTexture(smokeData, 32, 32, THREE.RGBAFormat)
  smokeTexture.needsUpdate = true
  const smokeMaterial = new THREE.SpriteMaterial({
    name: 'Shared television smoke',
    map: smokeTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  for (let index = 0; index < 5; index += 1) {
    const puff = new THREE.Sprite(smokeMaterial)
    puff.position.set((index % 2 ? 1 : -1) * .06, index * .1, (index - 2) * .035)
    puff.scale.setScalar(.22 + index * .045)
    smokeGroup.add(puff)
  }
  root.add(smokeGroup)

  const sparkPositions = new Float32Array([
    -.34, 0, 0, .34, 0, 0, 0, -.25, -.18, 0, .28, .18,
    -.25, -.18, .14, .27, .2, -.12, -.16, .28, -.16, .18, -.3, .18,
  ])
  const sparkGeometry = new THREE.BufferGeometry()
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
  const sparkMaterial = new THREE.LineBasicMaterial({
    name: 'Pool electric arcs',
    color: 0xd8ffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  })
  const sparks = new THREE.LineSegments(sparkGeometry, sparkMaterial)
  sparks.name = 'Pool television electric arcs'
  sparks.position.set(-3.6, -.38, 6.05)
  root.add(sparks)
  const sparkLight = new THREE.PointLight(0xb9ffff, 0, 7, 2)
  sparkLight.position.set(-3.6, -.08, 6.08)
  root.add(sparkLight)

  let lastFrame = ''
  function drawScreen(phase, countdownValue) {
    if (!screenContext || !screenTexture) return
    const frame = `${phase}:${countdownValue}`
    if (frame === lastFrame && phase !== 'discharge') return
    lastFrame = frame
    screenContext.fillStyle = phase === 'idle' ? '#120000' : '#ff0000'
    screenContext.fillRect(0, 0, 256, 160)
    if (phase === 'countdown') {
      screenContext.fillStyle = '#160000'
      screenContext.textAlign = 'center'
      screenContext.textBaseline = 'middle'
      screenContext.font = 'bold 116px monospace'
      screenContext.fillText(String(countdownValue), 128, 86)
    } else if (phase === 'discharge') {
      screenContext.strokeStyle = '#fff'
      screenContext.lineWidth = 5
      for (let index = 0; index < 7; index += 1) {
        screenContext.beginPath()
        screenContext.moveTo(Math.random() * 256, Math.random() * 160)
        screenContext.lineTo(Math.random() * 256, Math.random() * 160)
        screenContext.stroke()
      }
    }
    screenTexture.needsUpdate = true
  }
  drawScreen('idle', 5)

  return {
    root: television,
    screen,
    powerAnchor,
    interactionAnchor,
    interactionSize,
    update(state, time) {
      drawScreen(state.phase, state.countdownValue)
      const active = state.phase === 'discharge'
      sparkMaterial.opacity = active && Math.sin(time * 48) > -.2 ? .9 : 0
      sparks.rotation.y = time * 5.7
      sparks.scale.setScalar(.8 + Math.abs(Math.sin(time * 31)) * .7)
      sparkLight.intensity = active ? 22 + Math.abs(Math.sin(time * 43)) * 40 : 0
      smokeMaterial.opacity = active ? .18 : THREE.MathUtils.damp(smokeMaterial.opacity, 0, 2.5, 1 / 60)
      smokeGroup.children.forEach((puff, index) => {
        puff.position.y = index * .1 + (time * (.06 + index * .007)) % .55
      })
    },
  }
}

export function preparePoolRoom(root, televisionSource = null) {
  const waterMaterial = createPoolWaterMaterial()
  const causticsMaterial = createPoolCausticsMaterial()
  let waterSurface = null
  let exportedCeiling = null
  let puzzleState = createPoolPuzzleState()
  let electricalState = createPoolElectricalState()
  const duckTargetAngles = Object.fromEntries(POOL_DUCKS.map(({ id }) => [id, 0]))
  const puzzleDucks = {}
  let ladderProgress = 0
  const floatingParts = []
  const puzzleDuckParts = Object.fromEntries(POOL_DUCKS.map(({ id }) => [id, []]))
  const hazeSize = 48
  const hazeData = new Uint8Array(hazeSize * hazeSize * 4)
  for (let y = 0; y < hazeSize; y += 1) {
    for (let x = 0; x < hazeSize; x += 1) {
      const index = (y * hazeSize + x) * 4
      const distance = Math.hypot(x / (hazeSize - 1) * 2 - 1, y / (hazeSize - 1) * 2 - 1)
      const alpha = Math.max(0, 1 - distance)
      hazeData[index] = 210
      hazeData[index + 1] = 246
      hazeData[index + 2] = 246
      hazeData[index + 3] = Math.round(alpha * alpha * 255)
    }
  }
  const hazeTexture = new THREE.DataTexture(hazeData, hazeSize, hazeSize, THREE.RGBAFormat)
  hazeTexture.needsUpdate = true
  const hazeMaterial = new THREE.SpriteMaterial({
    name: 'Shared soft Tyndall haze',
    map: hazeTexture,
    color: 0xb9f4f0,
    transparent: true,
    opacity: .065,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  root.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = !object.name.includes('Water')
    object.receiveShadow = true
    if (object.name === 'PoolWaterSurface') {
      object.material?.dispose?.()
      object.material = waterMaterial
      waterSurface = object
    } else if (object.name === 'PoolCeiling') {
      exportedCeiling = object
    }
    const duckMatch = object.name.match(/^RubberDuck.*_([123])$/)
    if (duckMatch) {
      puzzleDuckParts[`duck-${duckMatch[1]}`].push(object)
    } else if (/^(RubberDuck|PinkSwimRing|YellowLifeRing|BlueInflatable|BeachBall)/.test(object.name)) {
      floatingParts.push({ object, baseY: object.position.y, x: object.position.x, z: object.position.z })
    }
  })
  if (exportedCeiling) {
    exportedCeiling.removeFromParent()
    exportedCeiling.geometry?.dispose()
  }
  POOL_DUCKS.forEach(({ id, objectIndex }) => {
    const puzzleDuck = new THREE.Group()
    puzzleDuck.name = `Rotatable puzzle duck ${objectIndex}`
    const parts = puzzleDuckParts[id]
    const body = parts.find(({ name }) => name.startsWith('RubberDuckBody'))
    if (body) puzzleDuck.position.copy(body.position)
    root.add(puzzleDuck)
    puzzleDuck.updateWorldMatrix(true, false)
    parts.forEach((part) => puzzleDuck.attach(part))
    puzzleDucks[id] = puzzleDuck
    floatingParts.push({
      object: puzzleDuck,
      baseY: puzzleDuck.position.y,
      x: puzzleDuck.position.x,
      z: puzzleDuck.position.z,
    })
  })
  const caustics = new THREE.Mesh(new THREE.PlaneGeometry(10.8, 14.8), causticsMaterial)
  caustics.name = 'Window-localized animated pool caustics'
  caustics.rotation.x = -Math.PI / 2
  caustics.position.y = -1.205
  caustics.renderOrder = 1
  root.add(caustics)

  const mirror = new Reflector(new THREE.PlaneGeometry(11.6, 15.6), {
    name: 'Clear pool ceiling mirror',
    shader: clearMirrorShader,
    textureWidth: 384,
    textureHeight: 384,
    multisample: 0,
    clipBias: .004,
    color: 0xaeb8b7,
  })
  mirror.name = 'Clear pool ceiling mirror'
  mirror.rotation.x = Math.PI / 2
  mirror.position.y = 5.985
  root.add(mirror)
  const ladder = createPoolPuzzleLadder()
  root.add(ladder)
  const electricalTelevision = createPoolElectricalTelevision(root, televisionSource)
  const blueFloat = root.getObjectByName('BlueInflatableMattress')
  const blueFloatAnchor = new THREE.Object3D()
  blueFloatAnchor.name = 'Blue float interaction anchor'
  if (blueFloat) {
    root.updateMatrixWorld(true)
    new THREE.Box3().setFromObject(blueFloat).getCenter(blueFloatAnchor.position)
    root.worldToLocal(blueFloatAnchor.position)
  }
  root.add(blueFloatAnchor)
  const ambience = new THREE.HemisphereLight(0xa6dfe0, 0x18353b, 1.45)
  ambience.name = 'Pool ambience'
  const poolGlow = new THREE.PointLight(0x56d6df, 42, 13, 2)
  poolGlow.name = 'Pool water glow'
  poolGlow.position.set(0, 1.05, 0)
  root.add(ambience, poolGlow)
  for (const lateral of [-3.3, 3.3]) {
    const start = new THREE.Vector3(lateral, 3.45, -7.66)
    const end = new THREE.Vector3(lateral * .38, .45, -.2)
    for (let index = 1; index <= 8; index += 1) {
      const progress = index / 9
      const haze = new THREE.Sprite(hazeMaterial)
      haze.name = `Pool Tyndall haze ${lateral} ${index}`
      haze.position.lerpVectors(start, end, progress)
      const size = .5 + progress * 2.5
      haze.scale.set(size, size * 1.12, 1)
      haze.renderOrder = 2
      root.add(haze)
    }
    const beam = new THREE.SpotLight(0xb8f3f1, 46, 13, Math.PI / 7, .72, 1.35)
    beam.name = `Pool window beam ${lateral}`
    beam.position.copy(start)
    beam.target.position.set(lateral * .45, .35, -.25)
    beam.castShadow = false
    root.add(beam, beam.target)
  }
  root.name = 'PoolRoom'
  return {
    root,
    waterSurface,
    puzzleDucks,
    ladder,
    blueFloat,
    blueFloatAnchor,
    electricalTelevision,
    getPuzzleState: () => puzzleState,
    getElectricalState: () => electricalState,
    startElectricalSequence() {
      electricalState = startPoolElectricalSequence(electricalState)
      return electricalState
    },
    resetElectricalAfterDeath() {
      electricalState = resetPoolElectricalAfterDeath(electricalState)
      return electricalState
    },
    unlockSecondTelevision() {
      electricalState = unlockSecondPoolTelevision(electricalState)
      return electricalState
    },
    rotateDuck(duckId) {
      const nextState = rotatePoolDuck(puzzleState, duckId)
      if (nextState === puzzleState) return puzzleState
      puzzleState = nextState
      duckTargetAngles[duckId] = puzzleState.ducks[duckId].angle
      if (puzzleState.solved) ladder.visible = true
      return puzzleState
    },
    isLadderReady: () => puzzleState.solved && ladderProgress >= .995,
    isFullLadderReady: () => puzzleState.solved && electricalState.ladderExtension >= .995,
    getClimbPosition(side = 1) {
      const height = electricalState.ladderExtension >= .995 ? 6.16 : 3.08
      return new THREE.Vector3(ladder.position.x, height, ladder.position.z + 1.65 * side)
    },
    getClimbBasePosition(eyeHeight, side = 1) {
      return new THREE.Vector3(ladder.position.x, eyeHeight, ladder.position.z + 1.65 * side)
    },
    update(deltaTime, { onFloat = false } = {}) {
      waterMaterial.uniforms.time.value += Math.min(deltaTime, .2)
      const time = waterMaterial.uniforms.time.value
      const previousElectricalState = electricalState
      electricalState = advancePoolElectricalState(electricalState, deltaTime, {
        onFloat,
        firstPuzzleSolved: puzzleState.solved,
      })
      causticsMaterial.uniforms.time.value = time
      hazeMaterial.opacity = .058 + Math.sin(time * .42) * .01
      POOL_DUCKS.forEach(({ id }) => {
        puzzleDucks[id].rotation.y = THREE.MathUtils.damp(
          puzzleDucks[id].rotation.y,
          duckTargetAngles[id],
          9,
          deltaTime,
        )
      })
      if (puzzleState.solved) {
        ladderProgress = THREE.MathUtils.damp(ladderProgress, 1, 3.8, deltaTime)
        const fullScale = 1 + electricalState.ladderExtension * (FULL_LADDER_SCALE - 1)
        ladder.scale.y = Math.max(.001, ladderProgress * fullScale)
      }
      const electricalIntensity = electricalState.phase === 'discharge'
        ? .55 + Math.abs(Math.sin(time * 37)) * .9
        : 0
      waterMaterial.uniforms.electricIntensity.value = electricalIntensity
      electricalTelevision.update(electricalState, time)
      floatingParts.forEach(({ object, baseY, x, z }) => {
        object.position.y = baseY + samplePoolWaveHeight(x, z, time) * .72
      })
      return {
        state: electricalState,
        dischargeStarted: previousElectricalState.phase !== 'discharge' && electricalState.phase === 'discharge',
        dischargeEnded: previousElectricalState.phase === 'discharge' && electricalState.phase === 'complete',
      }
    },
  }
}
