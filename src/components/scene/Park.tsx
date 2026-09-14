'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { glowTexture, paversTexture } from './textures'
import { Fireflies } from './Fireflies'
import { ALLEY, PLAZA } from './layout'

/**
 * Фонари. На площади аттракционов — два ряда по сторонам пути камеры
 * (≥ 5 м от него и от каруселей), на Главной аллее — по обеим сторонам,
 * мимо букв, шатра и столбов гирлянд.
 */
const PLAZA_LAMPS = [18, 4, -10, -24, -44].flatMap((z) => [
  [-6.2, z],
  [6.2, z],
])
const ALLEY_LAMPS = [
  ...[-72, -56, -40, -26, 26, 40, 56, 72].map((x) => [x, ALLEY.zNear + 0.6]),
  ...[-60, -44, -30, 32, 46, 62].map((x) => [x, ALLEY.zFar - 0.6]),
]
const LAMP_H = 5.2
const LAMPS: [number, number, number][] = [...PLAZA_LAMPS, ...ALLEY_LAMPS].map(([x, z]) => [x, LAMP_H, z])

/** Детерминированный шум — деревья не прыгают при перезагрузке */
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Ночной Атажукинский сад: площадь аттракционов из светлой плитки, поперёк
 * неё — Главная аллея из красного кирпичика, деревья с побелёнными стволами,
 * фонари, светлячки, звёзды. Сами аттракционы — в Attractions.tsx.
 *
 * Свет. Реальных источников всего четыре, и они «переезжают» к тем
 * фонарям, что ближе всего к камере. Два десятка настоящих pointLight —
 * это тормозящий forward-рендер на ноутбуке; дальние фонари всё равно
 * тонут в тумане, и их отличие не видно.
 */
export function Park({ quality }: { quality: 'high' | 'low' }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const bands = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const glow = useMemo(() => glowTexture(), [])
  // брусок ≈ 0.24 × 0.12 м: у площади светлая плитка, у аллеи — красный кирпичик
  const plazaTex = useMemo(() => paversTexture([38, 35], 29), [])
  const alleyTex = useMemo(() => paversTexture([100, 4], 23), [])

  const trees = useMemo(() => {
    const r = mulberry(42)
    const out: { x: number; z: number; s: number; h: number }[] = []
    // ровный ряд вдоль аллеи со стороны площади, между фонарями и столбами
    for (const x of [-64, -48, -33, -20, -12.5, 12.5, 20, 33, 48, 64]) {
      out.push({ x: x + (r() - 0.5) * 1.2, z: ALLEY.zNear + 2.3, s: 0.9 + r() * 0.35, h: 3.4 + r() * 1.2 })
    }
    const target = quality === 'high' ? 300 : 140
    let guard = 0
    while (out.length < target && guard++ < 8000) {
      const x = (r() - 0.5) * 170
      const z = 44 - r() * 170
      if (x > PLAZA.x0 + 3 && x < PLAZA.x1 - 3 && z < PLAZA.zNear - 3 && z > PLAZA.zFar) continue // площадь аттракционов
      if (z < ALLEY.zNear + 4 && z > ALLEY.zFar - 3) continue // аллея и ряд вдоль неё
      if (x > -22 && x < 25 && z < -60 && z > -106) continue // площадка у лофта, терраса, зал, шатёр
      out.push({ x, z, s: 0.8 + r() * 1.3, h: 2.2 + r() * 2.8 })
    }
    return out
  }, [quality])

  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    const r = mulberry(9)
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.h / 2, t.z), q, new THREE.Vector3(0.18 * t.s, t.h, 0.18 * t.s))
      trunks.current!.setMatrixAt(i, m)
      // побелённый низ ствола — примета деревьев парка, видна на фото у террасы
      m.compose(new THREE.Vector3(t.x, 0.6, t.z), q, new THREE.Vector3(0.2 * t.s, 1.2, 0.2 * t.s))
      bands.current?.setMatrixAt(i, m)
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3))
      m.compose(new THREE.Vector3(t.x, t.h + 1.2 * t.s, t.z), q, new THREE.Vector3(1.9 * t.s, 2.3 * t.s, 1.9 * t.s))
      crowns.current!.setMatrixAt(i, m)
      col.setHSL(0.27 + r() * 0.08, 0.35 + r() * 0.2, 0.1 + r() * 0.08)
      crowns.current!.setColorAt(i, col)
      q.identity()
    })
    trunks.current.instanceMatrix.needsUpdate = true
    if (bands.current) bands.current.instanceMatrix.needsUpdate = true
    crowns.current.instanceMatrix.needsUpdate = true
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
  }, [trees])

  const sorted = useRef(LAMPS.map((_, i) => i))
  useFrame(({ camera }) => {
    const cz = camera.position.z
    const cx = camera.position.x
    sorted.current.sort(
      (a, b) =>
        Math.hypot(LAMPS[a][0] - cx, LAMPS[a][2] - cz) - Math.hypot(LAMPS[b][0] - cx, LAMPS[b][2] - cz),
    )
    lights.current.forEach((l, i) => {
      if (!l) return
      const p = LAMPS[sorted.current[i]]
      l.position.set(p[0], p[1] - 0.3, p[2])
    })
  })

  const alleyZ = (ALLEY.zNear + ALLEY.zFar) / 2

  return (
    <group>
      {/* земля */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[280, 280]} />
        <meshStandardMaterial color="#0b100c" roughness={1} />
      </mesh>
      {/* площадь аттракционов */}
      <mesh rotation-x={-Math.PI / 2} position={[(PLAZA.x0 + PLAZA.x1) / 2, 0.008, (PLAZA.zNear + PLAZA.zFar) / 2]}>
        <planeGeometry args={[PLAZA.x1 - PLAZA.x0, PLAZA.zNear - PLAZA.zFar]} />
        <meshStandardMaterial map={plazaTex} color="#d6d0c6" roughness={0.9} />
      </mesh>
      {/* Главная аллея поперёк пути и серые бордюрные ленты по краям */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, alleyZ]}>
        <planeGeometry args={[ALLEY.x1 - ALLEY.x0, ALLEY.zNear - ALLEY.zFar]} />
        <meshStandardMaterial map={alleyTex} color="#e0b8a8" roughness={0.9} />
      </mesh>
      {[ALLEY.zNear, ALLEY.zFar].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.016, z]}>
          <planeGeometry args={[ALLEY.x1 - ALLEY.x0, 0.35]} />
          <meshStandardMaterial color="#77736d" roughness={0.9} />
        </mesh>
      ))}

      {/* фонари: высокая стойка, светильник-«таблетка» и пятно света */}
      {LAMPS.map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, y / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.1, y, 8]} />
            <meshStandardMaterial color="#1c1b1a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, y + 0.08, 0]}>
            <cylinderGeometry args={[0.34, 0.22, 0.16, 12]} />
            <meshStandardMaterial color="#1c1b1a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, y - 0.02, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.06, 12]} />
            <meshBasicMaterial color={[6, 4.4, 2.4]} toneMapped={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
            <planeGeometry args={[10, 10]} />
            <meshBasicMaterial map={glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}

      {/* лавочки вдоль аллеи со стороны площади */}
      {[-52, -36, 36, 52].map((x) => (
        <group key={x} position={[x, 0, ALLEY.zNear + 0.9]} rotation-y={Math.PI}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.8, 0.07, 0.5]} />
            <meshStandardMaterial color="#4a2e1c" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.75, -0.24]}>
            <boxGeometry args={[1.8, 0.45, 0.06]} />
            <meshStandardMaterial color="#4a2e1c" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {[0, 1, 2, 3].map((i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el
          }}
          color="#ffb46a"
          intensity={14}
          distance={16}
          decay={1.6}
        />
      ))}

      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.6, 1, 1, 6]} />
        <meshStandardMaterial color="#1e1612" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={bands} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.95, 1, 1, 6]} />
        <meshStandardMaterial color="#cfccc2" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>

      {/* луна */}
      <mesh position={[-60, 55, -160]}>
        <sphereGeometry args={[5, 32, 16]} />
        <meshBasicMaterial color={[2.2, 2.1, 1.9]} toneMapped={false} />
      </mesh>
      <Stars radius={180} depth={60} count={quality === 'high' ? 3000 : 1200} factor={5} saturation={0} fade speed={0.4} />

      <Fireflies count={quality === 'high' ? 700 : 260} />
      <Fireflies count={quality === 'high' ? 160 : 60} center={[17, 2.5, -82]} area={[26, 4, 30]} color="#ffd9a0" size={90} />
    </group>
  )
}
