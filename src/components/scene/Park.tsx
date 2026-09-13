'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { glowTexture } from './textures'
import { Fireflies } from './Fireflies'

// Фонари только на аллее: дальше начинается площадь лофта (layout.ts)
const LAMP_Z = Array.from({ length: 8 }, (_, i) => 8 - i * 8.6)
export const LAMPS: [number, number, number][] = LAMP_Z.map((z, i) => [i % 2 ? 3.1 : -3.1, 3.9, z])

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
 * Ночной парк: аллея, фонари, деревья, светлячки, звёзды.
 *
 * Свет. Реальных источников всего четыре, и они «переезжают» к тем
 * фонарям, что ближе всего к камере. Девять настоящих pointLight на
 * аллее плюс интерьер — это уже тормозящий forward-рендер на ноутбуке;
 * дальние фонари всё равно тонут в тумане, и их отличие не видно.
 */
export function Park({ quality }: { quality: 'high' | 'low' }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const glow = useMemo(() => glowTexture(), [])

  const trees = useMemo(() => {
    const r = mulberry(42)
    const out: { x: number; z: number; s: number; h: number }[] = []
    const target = quality === 'high' ? 320 : 150
    let guard = 0
    while (out.length < target && guard++ < 5000) {
      const x = (r() - 0.5) * 110
      const z = 22 - r() * 150
      const ax = Math.abs(x)
      if (ax < 5.2 && z > -56) continue // аллея
      if (x > -21 && x < 25 && z < -53 && z > -106) continue // площадь, терраса, зал, шатёр
      if (x > -37 && x < -23 && z < -76 && z > -92) continue // карусель
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
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3))
      m.compose(new THREE.Vector3(t.x, t.h + 1.2 * t.s, t.z), q, new THREE.Vector3(1.9 * t.s, 2.3 * t.s, 1.9 * t.s))
      crowns.current!.setMatrixAt(i, m)
      col.setHSL(0.27 + r() * 0.08, 0.35 + r() * 0.2, 0.1 + r() * 0.08)
      crowns.current!.setColorAt(i, col)
      q.identity()
    })
    trunks.current.instanceMatrix.needsUpdate = true
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
      l.position.set(p[0], p[1] - 0.2, p[2])
    })
  })

  return (
    <group>
      {/* земля и аллея */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#0b100c" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -22]}>
        <planeGeometry args={[4.6, 68]} />
        <meshStandardMaterial color="#3a332b" roughness={0.9} />
      </mesh>
      {/* бордюры */}
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} position={[x, 0.06, -22]}>
          <boxGeometry args={[0.18, 0.12, 68]} />
          <meshStandardMaterial color="#58514a" roughness={0.8} />
        </mesh>
      ))}

      {/* фонари */}
      {LAMPS.map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, y / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.08, y, 8]} />
            <meshStandardMaterial color="#1c1b1a" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, y + 0.05, 0]}>
            <cylinderGeometry args={[0.28, 0.08, 0.22, 8]} />
            <meshStandardMaterial color="#1c1b1a" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, y - 0.18, 0]}>
            <sphereGeometry args={[0.17, 16, 12]} />
            <meshBasicMaterial color={[6, 3.6, 1.6]} toneMapped={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[x > 0 ? -1.2 : 1.2, 0.03, 0]}>
            <planeGeometry args={[9, 9]} />
            <meshBasicMaterial map={glow} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {/* скамейка у каждого второго фонаря */}
          {i % 2 === 0 && (
            <group position={[x > 0 ? 0.9 : -0.9, 0, 1.6]} rotation-y={x > 0 ? -Math.PI / 2 : Math.PI / 2}>
              <mesh position={[0, 0.45, 0]}>
                <boxGeometry args={[1.8, 0.07, 0.5]} />
                <meshStandardMaterial color="#4a2e1c" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.75, -0.24]}>
                <boxGeometry args={[1.8, 0.45, 0.06]} />
                <meshStandardMaterial color="#4a2e1c" roughness={0.8} />
              </mesh>
            </group>
          )}
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
