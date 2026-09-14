'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fx } from './fx'
import { KIOSKS, RIDES } from './layout'
import { Instances, mat } from './instancing'
import { glowTexture } from './textures'

/**
 * Парк аттракционов Атажукинского сада — то, через что на самом деле идут
 * к Loft Park: колесо обозрения, детские карусели с красно-белыми куполами
 * (их видно даже со спутника), бассейн с бамперными лодками, фонтан «Слоны»
 * и киоски с красными крышами. Цепочная карусель — в Carousel.tsx.
 *
 * Новых источников света нет: огни — светящиеся материалы под bloom,
 * отсвет на плитке — аддитивные пятна. Каждая pointLight дорожает для
 * всей сцены, а площадь большая.
 */

/** Полосы по секторам: у куполов каруселей чередуются красный и белый */
export function striped(geometry: THREE.BufferGeometry, segments: number, colors: string[]) {
  const g = geometry.toNonIndexed()
  const pos = g.attributes.position
  const out = new Float32Array(pos.count * 3)
  const palette = colors.map((c) => new THREE.Color(c))
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * segments)
    const c = palette[seg % palette.length]
    for (let k = 0; k < 3; k++) out.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3))
  g.computeVertexNormals()
  return g
}

// Вода с подсветкой снизу: бегущие блики, туман — штатными чанками three.js
const waterVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const waterFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uGlow;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 9.0;
    float w = sin(p.x * 1.7 + uTime * 1.3) * sin(p.y * 1.3 - uTime * 1.1) + sin((p.x + p.y) * 2.3 + uTime * 0.7) * 0.5;
    float caustic = smoothstep(0.55, 1.2, w);
    vec2 c = vUv - 0.5;
    float center = 1.0 - smoothstep(0.1, 0.5, length(c));
    vec3 col = uDeep + uGlow * (0.25 + 0.35 * center) + uGlow * caustic * 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

function useWater(deep: string, glow: string) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(deep) },
          uGlow: { value: new THREE.Color(glow) },
        },
      }),
    [deep, glow],
  )
  useFrame((_, dt) => {
    if (!fx.reduced) material.uniforms.uTime.value += dt
  })
  return material
}

/** Тёплое пятно света на плитке вместо pointLight */
function Glow({ x, z, size, color = '#ffcf94', opacity = 0.5 }: { x: number; z: number; size: number; color?: string; opacity?: number }) {
  const tex = useMemo(() => glowTexture(), [])
  return (
    // 8 см над плиткой: ближе — издалека и сверху пятно мерцает (z-fighting)
    <mesh rotation-x={-Math.PI / 2} position={[x, 0.08, z]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

const bulbMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.4, 1.5), toneMapped: false })
const bulbGeometry = new THREE.SphereGeometry(0.08, 8, 6)

// ─────────────────────────── колесо обозрения ───────────────────────────

const CABINS = 18
const RIM_BULBS = 64

function FerrisWheel() {
  const { x, z, rotY, R } = RIDES.wheel
  const H = R + 2.8
  const wheel = useRef<THREE.Group>(null)
  const cabins = useRef<THREE.InstancedMesh>(null)
  const windows = useRef<THREE.InstancedMesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const lastStep = useRef(-1)

  const geos = useMemo(() => {
    const body = new THREE.BoxGeometry(1.1, 0.95, 0.95)
    const roof = new THREE.BoxGeometry(1.26, 0.12, 1.08).translate(0, 0.53, 0)
    const hanger = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5).translate(0, 0.8, 0)
    return {
      cabin: mergeGeometries([body, roof, hanger])!,
      window: new THREE.BoxGeometry(1.13, 0.36, 0.98).translate(0, 0.08, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
    }
  }, [])
  const mats = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: '#e6e2da', metalness: 0.3, roughness: 0.5 }),
      cabin: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      window: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.7), toneMapped: false }),
    }),
    [],
  )

  const statics = useMemo(() => {
    const spokes: THREE.Matrix4[] = []
    const beams: THREE.Matrix4[] = []
    for (let i = 0; i < CABINS; i++) {
      const a = (i / CABINS) * Math.PI * 2
      for (const side of [-0.8, 0.8]) {
        // спица: центр на середине радиуса; поворот на a − π/2 уводит ось Y к ободу
        spokes.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, side),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2)),
            new THREE.Vector3(0.07, R, 0.07),
          ),
        )
      }
      beams.push(mat([Math.cos(a) * R, Math.sin(a) * R, 0], [0.08, 0.08, 1.7]))
    }
    // А-образные опоры от земли к оси
    const legs: THREE.Matrix4[] = []
    const up = new THREE.Vector3(0, 1, 0)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const foot = new THREE.Vector3(sx * 5, 0, sz * 2.4)
        const top = new THREE.Vector3(0, H, sz * 1.05)
        const dir = top.clone().sub(foot)
        legs.push(new THREE.Matrix4().compose(foot.clone().add(top).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(0.24, dir.length(), 0.24)))
      }
    }
    return { spokes, beams, legs }
  }, [H, R])

  const palette = useMemo(() => ['#ffd08a', '#ff5fa2', '#62d6ff', '#fff4e0'].map((c) => new THREE.Color(c).multiplyScalar(4.5)), [])
  const cabinColors = useMemo(() => ['#d8343c', '#f2b632', '#2f7fd1', '#3aa35a', '#e8702a', '#8a4fc2'].map((c) => new THREE.Color(c)), [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < RIM_BULBS; k++) {
        const a = (k / RIM_BULBS) * Math.PI * 2
        bulbs.current?.setMatrixAt(side * RIM_BULBS + k, m.makeTranslation(Math.cos(a) * (R + 0.14), Math.sin(a) * (R + 0.14), side ? 0.8 : -0.8))
      }
    }
    if (bulbs.current) bulbs.current.instanceMatrix.needsUpdate = true
    for (let i = 0; i < CABINS; i++) cabins.current?.setColorAt(i, cabinColors[i % cabinColors.length])
    if (cabins.current?.instanceColor) cabins.current.instanceColor.needsUpdate = true
  }, [R, cabinColors])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const t = fx.reduced ? 0 : clock.elapsedTime
    const angle = t * 0.06 + 0.3
    if (wheel.current) wheel.current.rotation.z = angle
    for (let i = 0; i < CABINS; i++) {
      const a = (i / CABINS) * Math.PI * 2 + angle
      // кабина висит на оси и всегда остаётся вертикальной
      m.compose(v.set(Math.cos(a) * R, H + Math.sin(a) * R - 0.85, 0), q, one)
      cabins.current?.setMatrixAt(i, m)
      windows.current?.setMatrixAt(i, m)
    }
    if (cabins.current) cabins.current.instanceMatrix.needsUpdate = true
    if (windows.current) windows.current.instanceMatrix.needsUpdate = true
    // бегущие огни по ободу: узор сдвигается раз в 0.12 с
    const step = Math.floor(t / 0.12)
    if (step !== lastStep.current && bulbs.current) {
      lastStep.current = step
      for (let i = 0; i < RIM_BULBS * 2; i++) bulbs.current.setColorAt(i, palette[(i + step) % palette.length])
      if (bulbs.current.instanceColor) bulbs.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      <Instances items={statics.legs} geometry={geos.box} material={mats.frame} />
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2} material={mats.frame}>
        <cylinderGeometry args={[0.55, 0.55, 2.4, 16]} />
      </mesh>
      <group ref={wheel} position={[0, H, 0]}>
        {[-0.8, 0.8].map((side) => (
          <group key={side} position-z={side}>
            <mesh material={mats.frame}>
              <torusGeometry args={[R, 0.1, 6, 120]} />
            </mesh>
            <mesh material={mats.frame}>
              <torusGeometry args={[R * 0.3, 0.08, 6, 48]} />
            </mesh>
          </group>
        ))}
        <Instances items={statics.spokes} geometry={geos.box} material={mats.frame} />
        <Instances items={statics.beams} geometry={geos.box} material={mats.frame} />
        <instancedMesh ref={bulbs} args={[bulbGeometry, undefined, RIM_BULBS * 2]}>
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>
      <instancedMesh ref={cabins} args={[geos.cabin, mats.cabin, CABINS]} frustumCulled={false} />
      <instancedMesh ref={windows} args={[geos.window, mats.window, CABINS]} frustumCulled={false} />
      <Glow x={0} z={0} size={22} opacity={0.35} color="#ffb8d8" />
    </group>
  )
}

// ─────────────────────────── детская карусель ───────────────────────────

const HORSES = 8

function KiddieCarousel({ x, z, r, speed }: { x: number; z: number; r: number; speed: number }) {
  const spin = useRef<THREE.Group>(null)
  const horses = useRef<THREE.InstancedMesh>(null)
  const rh = r * 0.68

  const geos = useMemo(() => {
    const body = new THREE.CapsuleGeometry(0.17, 0.55, 4, 8).rotateX(Math.PI / 2)
    const neck = new THREE.BoxGeometry(0.14, 0.4, 0.16).rotateX(-0.5).translate(0, 0.22, 0.36)
    const head = new THREE.BoxGeometry(0.16, 0.16, 0.32).translate(0, 0.42, 0.5)
    const legs = [-0.2, 0.2].flatMap((lz) => [-0.09, 0.09].map((lx) => new THREE.CylinderGeometry(0.03, 0.03, 0.42, 5).translate(lx, -0.3, lz)))
    return {
      horse: mergeGeometries([body, neck, head, ...legs])!,
      canopy: striped(new THREE.ConeGeometry(r + 0.55, 1.5, 24, 1, true), 24, ['#c8202c', '#f4efe4']),
      valance: striped(new THREE.CylinderGeometry(r + 0.55, r + 0.55, 0.5, 24, 1, true), 24, ['#f4efe4', '#c8202c']),
      pole: new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
    }
  }, [r])
  const mats = useMemo(
    () => ({
      stripes: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
      horse: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9b25a', metalness: 0.7, roughness: 0.3 }),
    }),
    [],
  )

  const statics = useMemo(() => {
    const poles: THREE.Matrix4[] = []
    const lights: THREE.Matrix4[] = []
    for (let i = 0; i < HORSES; i++) {
      const a = (i / HORSES) * Math.PI * 2
      poles.push(mat([Math.cos(a) * rh, 1.45, Math.sin(a) * rh], [1, 2.2, 1]))
    }
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2
      lights.push(mat([Math.cos(a) * (r + 0.58), 2.5, Math.sin(a) * (r + 0.58)]))
    }
    return { poles, lights }
  }, [r, rh])

  const colors = useMemo(() => ['#f1ece2', '#e9c9a8', '#c7d9e8', '#f0d38a'].map((c) => new THREE.Color(c)), [])
  useLayoutEffect(() => {
    for (let i = 0; i < HORSES; i++) horses.current?.setColorAt(i, colors[i % colors.length])
    if (horses.current?.instanceColor) horses.current.instanceColor.needsUpdate = true
  }, [colors])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const t = fx.reduced ? 0 : clock.elapsedTime
    if (spin.current) spin.current.rotation.y = t * speed
    for (let i = 0; i < HORSES; i++) {
      const a = (i / HORSES) * Math.PI * 2
      // лошадка смотрит по касательной и качается вверх-вниз на шесте
      q.setFromEuler(e.set(0, -a + (speed < 0 ? Math.PI : 0), 0))
      m.compose(v.set(Math.cos(a) * rh, 1.05 + Math.sin(t * 2.2 + i * 0.8) * 0.16, Math.sin(a) * rh), q, one)
      horses.current?.setMatrixAt(i, m)
    }
    if (horses.current) horses.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[r + 0.25, r + 0.35, 0.24, 32]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.7} />
      </mesh>
      <group ref={spin}>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[r, r, 0.16, 32]} />
          <meshStandardMaterial color="#8b2a2a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.55, 0]} material={mats.gold}>
          <cylinderGeometry args={[0.32, 0.32, 2.5, 16]} />
        </mesh>
        <mesh position={[0, 2.75, 0]} geometry={geos.valance} material={mats.stripes} />
        <mesh position={[0, 3.75, 0]} geometry={geos.canopy} material={mats.stripes} />
        <mesh position={[0, 4.6, 0]} material={mats.gold}>
          <sphereGeometry args={[0.2, 12, 8]} />
        </mesh>
        <mesh position={[0, 4.85, 0]} geometry={bulbGeometry} material={bulbMaterial} />
        <Instances items={statics.poles} geometry={geos.pole} material={mats.gold} />
        <Instances items={statics.lights} geometry={bulbGeometry} material={bulbMaterial} />
        <instancedMesh ref={horses} args={[geos.horse, mats.horse, HORSES]} frustumCulled={false} />
      </group>
      <Glow x={0} z={0} size={r * 4.2} opacity={0.55} />
    </group>
  )
}

// ─────────────────────────── бамперные лодки ───────────────────────────

const BOATS = 6

function roundedRect(w: number, d: number, rad: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + rad, y)
  s.lineTo(x + w - rad, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rad)
  s.lineTo(x + w, y + d - rad)
  s.quadraticCurveTo(x + w, y + d, x + w - rad, y + d)
  s.lineTo(x + rad, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - rad)
  s.lineTo(x, y + rad)
  s.quadraticCurveTo(x, y, x + rad, y)
  return s
}

function BumperBoats() {
  const { x, z } = RIDES.boats
  const W = 12
  const D = 9
  const water = useWater('#032433', '#1a9cc4')
  const boats = useRef<THREE.InstancedMesh>(null)
  const seats = useRef<THREE.InstancedMesh>(null)
  const lamps = useRef<THREE.InstancedMesh>(null)

  const geos = useMemo(() => {
    const outer = roundedRect(W, D, 1.6)
    outer.holes.push(new THREE.Path(roundedRect(W - 0.7, D - 0.7, 1.3).getPoints(48).reverse()))
    return {
      wall: new THREE.ExtrudeGeometry(outer, { depth: 0.6, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2),
      ring: new THREE.TorusGeometry(0.62, 0.26, 8, 20).rotateX(Math.PI / 2),
      seat: new THREE.CylinderGeometry(0.36, 0.4, 0.4, 14),
    }
  }, [])
  const colors = useMemo(() => ['#e0303a', '#f2c230', '#2f7fd1', '#3aa35a', '#e8702a', '#b04fc2'].map((c) => new THREE.Color(c)), [])
  useLayoutEffect(() => {
    colors.forEach((c, i) => boats.current?.setColorAt(i, c))
    if (boats.current?.instanceColor) boats.current.instanceColor.needsUpdate = true
  }, [colors])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const t = fx.reduced ? 3 : clock.elapsedTime
    for (let i = 0; i < BOATS; i++) {
      // каждая лодка ходит по своей петле в пределах бассейна
      const px = Math.sin(t * 0.23 * (1 + i * 0.13) + i * 1.7) * (W / 2 - 1.5)
      const pz = Math.cos(t * 0.19 * (1 + i * 0.09) + i * 2.3) * (D / 2 - 1.5)
      const py = 0.5 + Math.sin(t * 1.5 + i) * 0.04
      q.setFromEuler(e.set(Math.sin(t + i) * 0.04, t * 0.3 * (i % 2 ? 1 : -1), 0))
      m.compose(v.set(px, py, pz), q, one)
      boats.current?.setMatrixAt(i, m)
      seats.current?.setMatrixAt(i, m)
      m.compose(v.set(px, py + 0.5, pz), q, one)
      lamps.current?.setMatrixAt(i, m)
    }
    ;[boats, seats, lamps].forEach((ref) => ref.current && (ref.current.instanceMatrix.needsUpdate = true))
  })

  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geos.wall}>
        <meshStandardMaterial color="#dfe7ea" roughness={0.5} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.42, 0]} material={water}>
        <planeGeometry args={[W - 0.6, D - 0.6]} />
      </mesh>
      <instancedMesh ref={boats} args={[geos.ring, undefined, BOATS]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={seats} args={[geos.seat, undefined, BOATS]} frustumCulled={false}>
        <meshStandardMaterial color="#1d2430" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[bulbGeometry, bulbMaterial, BOATS]} frustumCulled={false} />
      <Glow x={0} z={0} size={16} color="#6fd3ff" opacity={0.3} />
    </group>
  )
}

// ─────────────────────────── фонтан «Слоны» ───────────────────────────

const jetVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aDir;
  attribute float aPhase;
  varying float vA;
  void main() {
    // частица летит по параболе из хобота и падает в чашу
    float s = fract(uTime * 0.55 + aPhase) * 0.9;
    vec3 p = position + aDir * s + vec3(0.0, -4.9, 0.0) * s * s;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 16.0 * uPixelRatio / max(-mv.z, 0.2);
    vA = 1.0 - s * 0.6;
  }
`
const jetFragment = /* glsl */ `
  varying float vA;
  void main() {
    // защита от деления на ноль: иначе NaN → чёрные квадраты в bloom (см. Fireflies)
    float d = max(distance(gl_PointCoord, vec2(0.5)), 0.02);
    float g = min(0.08 / d - 0.16, 2.0);
    if (g <= 0.0) discard;
    gl_FragColor = vec4(vec3(0.8, 0.93, 1.0) * 1.4, clamp(g * vA, 0.0, 1.0));
  }
`

function ElephantFountain({ quality }: { quality: 'high' | 'low' }) {
  const { x, z } = RIDES.fountain
  const water = useWater('#04202c', '#2aa8d8')
  const dpr = useThree((s) => s.viewport.dpr)
  const jetMat = useRef<THREE.ShaderMaterial>(null)

  // Слон собран из сфер и цилиндров, хобот поднят — из него бьёт струя
  const elephant = useMemo(() => {
    const trunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.02, 0.78),
      new THREE.Vector3(0, 0.82, 1.02),
      new THREE.Vector3(0, 0.92, 1.28),
      new THREE.Vector3(0, 1.3, 1.42),
    ])
    const parts = [
      new THREE.SphereGeometry(0.5, 16, 12).scale(0.8, 0.72, 1).translate(0, 0.78, 0),
      new THREE.SphereGeometry(0.34, 14, 10).translate(0, 1.08, 0.55),
      ...[-1, 1].map((s) => new THREE.SphereGeometry(0.3, 12, 8).scale(0.22, 1, 0.85).translate(s * 0.3, 1.1, 0.42)),
      ...[-0.24, 0.24].flatMap((lz) => [-0.22, 0.22].map((lx) => new THREE.CylinderGeometry(0.12, 0.13, 0.56, 8).translate(lx, 0.28, lz))),
      new THREE.TubeGeometry(trunk, 16, 0.07, 6, false),
      ...[-1, 1].map((s) => new THREE.ConeGeometry(0.04, 0.3, 6).rotateX(Math.PI / 2 + 0.4).translate(s * 0.12, 0.92, 0.82)),
    ]
    // у разных геометрий разный набор атрибутов не бывает: все штатные, с uv
    return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!
  }, [])
  const TIP = new THREE.Vector3(0, 1.3, 1.42)

  const jets = useMemo(() => {
    const perJet = quality === 'high' ? 90 : 45
    const pos: number[] = []
    const dir: number[] = []
    const phase: number[] = []
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      const theta = Math.PI / 2 - a
      const tip = TIP.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), theta).add(new THREE.Vector3(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6))
      for (let i = 0; i < perJet; i++) {
        pos.push(tip.x, tip.y, tip.z)
        const spread = 1.5 + Math.random() * 0.25
        dir.push(Math.cos(a) * spread + (Math.random() - 0.5) * 0.15, 2.1 + Math.random() * 0.25, Math.sin(a) * spread + (Math.random() - 0.5) * 0.15)
        phase.push(i / perJet + Math.random() * 0.01)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: Math.min(dpr, 2) } }), [dpr])
  useFrame((_, dt) => {
    if (jetMat.current && !fx.reduced) jetMat.current.uniforms.uTime.value += dt
  })

  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a59d90', roughness: 0.85 }), [])
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f8b84', metalness: 0.35, roughness: 0.45 }), [])

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} material={stone}>
        <cylinderGeometry args={[3.6, 3.7, 0.6, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation-x={Math.PI / 2} material={stone}>
        <torusGeometry args={[3.62, 0.18, 8, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.45, 0]} material={water}>
        <circleGeometry args={[3.55, 48]} />
      </mesh>
      <mesh position={[0, 0.4, 0]} material={stone}>
        <cylinderGeometry args={[1.05, 1.15, 0.8, 24]} />
      </mesh>
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return <mesh key={k} geometry={elephant} material={bronze} position={[Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6]} rotation-y={Math.PI / 2 - a} />
      })}
      <points geometry={jets} frustumCulled={false}>
        <shaderMaterial ref={jetMat} vertexShader={jetVertex} fragmentShader={jetFragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <Glow x={0} z={0} size={11} color="#7fd8ff" opacity={0.35} />
    </group>
  )
}

// ─────────────────────────── киоски ───────────────────────────

function Kiosks() {
  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      // четырёхскатная крыша: конус на 4 грани, повёрнутый ребром к углам
      roof: new THREE.ConeGeometry(2.2, 0.9, 4).rotateY(Math.PI / 4),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#ebe6dc', roughness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({ color: '#b8262c', roughness: 0.6 }),
      window: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.9), toneMapped: false }),
    }),
    [],
  )
  const items = useMemo(() => {
    const bodies: THREE.Matrix4[] = []
    const roofs: THREE.Matrix4[] = []
    const windows: THREE.Matrix4[] = []
    KIOSKS.forEach(([x, z, ry]) => {
      bodies.push(mat([x, 1.25, z], [2.8, 2.5, 2.2], ry))
      roofs.push(mat([x, 2.95, z], [1, 1, 0.8], ry))
      // окно выдачи на лицевой стороне (локальная +z)
      windows.push(mat([x + Math.sin(ry) * 1.11, 1.5, z + Math.cos(ry) * 1.11], [2, 0.85, 0.02], ry))
    })
    return { bodies, roofs, windows }
  }, [])
  return (
    <group>
      <Instances items={items.bodies} geometry={geos.box} material={mats.body} />
      <Instances items={items.roofs} geometry={geos.roof} material={mats.roof} />
      <Instances items={items.windows} geometry={geos.box} material={mats.window} />
      {KIOSKS.map(([x, z, ry]) => (
        <Glow key={`${x}${z}`} x={x + Math.sin(ry) * 2.2} z={z + Math.cos(ry) * 2.2} size={5} opacity={0.4} />
      ))}
    </group>
  )
}

export function Attractions({ quality }: { quality: 'high' | 'low' }) {
  return (
    <group>
      <FerrisWheel />
      <KiddieCarousel {...RIDES.carouselA} speed={0.32} />
      <KiddieCarousel {...RIDES.carouselB} speed={-0.4} />
      <BumperBoats />
      <ElephantFountain quality={quality} />
      <Kiosks />
    </group>
  )
}
