import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

export const POOL_BOUNDS = Object.freeze({ minX: -5.05, maxX: 5.05, minZ: -7.05, maxZ: 7.05 })
export const POOL_COLUMN_RADIUS = 1.12

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
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vWaveHeight;
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
        gl_FragColor = vec4(color, .74 + fresnel * .16);
      }
    `,
  })
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

const blurredMirrorShader = {
  name: 'Blurred pool ceiling mirror shader',
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
      vec2 stepSize = texelSize * 1.65;
      vec3 blurred = texture2D(tDiffuse, uv).rgb * .20;
      blurred += texture2D(tDiffuse, uv + vec2(stepSize.x, 0.0)).rgb * .12;
      blurred += texture2D(tDiffuse, uv - vec2(stepSize.x, 0.0)).rgb * .12;
      blurred += texture2D(tDiffuse, uv + vec2(0.0, stepSize.y)).rgb * .12;
      blurred += texture2D(tDiffuse, uv - vec2(0.0, stepSize.y)).rgb * .12;
      blurred += texture2D(tDiffuse, uv + stepSize).rgb * .08;
      blurred += texture2D(tDiffuse, uv - stepSize).rgb * .08;
      blurred += texture2D(tDiffuse, uv + vec2(stepSize.x, -stepSize.y)).rgb * .08;
      blurred += texture2D(tDiffuse, uv + vec2(-stepSize.x, stepSize.y)).rgb * .08;
      gl_FragColor = vec4(mix(blurred, color, .16), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

export function preparePoolRoom(root) {
  const waterMaterial = createPoolWaterMaterial()
  const causticsMaterial = createPoolCausticsMaterial()
  let waterSurface = null
  const floatingParts = []
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
      object.visible = false
    }
    if (/^(RubberDuck|PinkSwimRing|YellowLifeRing|BlueInflatable|BeachBall)/.test(object.name)) {
      floatingParts.push({ object, baseY: object.position.y, x: object.position.x, z: object.position.z })
    }
  })
  const caustics = new THREE.Mesh(new THREE.PlaneGeometry(10.8, 14.8), causticsMaterial)
  caustics.name = 'Window-localized animated pool caustics'
  caustics.rotation.x = -Math.PI / 2
  caustics.position.y = -1.205
  caustics.renderOrder = 1
  root.add(caustics)

  const mirror = new Reflector(new THREE.PlaneGeometry(11.6, 15.6), {
    name: 'Blurred pool ceiling mirror',
    shader: blurredMirrorShader,
    textureWidth: 256,
    textureHeight: 256,
    multisample: 0,
    clipBias: .004,
    color: 0x9aa9a8,
  })
  mirror.name = 'Blurred pool ceiling mirror'
  mirror.rotation.x = Math.PI / 2
  mirror.position.y = 5.985
  const renderMirror = mirror.onBeforeRender
  let mirrorFrame = 0
  mirror.onBeforeRender = function (...args) {
    mirrorFrame += 1
    if (mirrorFrame % 2) return
    renderMirror.apply(this, args)
  }
  root.add(mirror)
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
    update(deltaTime) {
      waterMaterial.uniforms.time.value += Math.min(deltaTime, .2)
      const time = waterMaterial.uniforms.time.value
      causticsMaterial.uniforms.time.value = time
      hazeMaterial.opacity = .058 + Math.sin(time * .42) * .01
      floatingParts.forEach(({ object, baseY, x, z }) => {
        object.position.y = baseY + samplePoolWaveHeight(x, z, time) * .72
      })
    },
  }
}
