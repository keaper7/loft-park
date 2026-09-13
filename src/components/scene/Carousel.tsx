'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'

const SEATS = 16
const RADIUS = 3.2
const CHAIN = 2.4

/**
 * Карусель-«волна» из парка аттракционов за лофтом — в кадрах гостей она
 * светится за деревьями. Узнаваемость места строится и на соседях.
 * Сиденья разлетаются наружу по мере раскрутки; огни по кругу бегут.
 */
export function Carousel({ position = [-30, 0, -84] as [number, number, number] }) {
  const top = useRef<THREE.Group>(null)
  const chains = useRef<THREE.InstancedMesh>(null)
  const seats = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const colors = useMemo(() => ['#ffb561', '#ff4f9a', '#6fd3ff', '#f4f0e6'].map((c) => new THREE.Color(c).multiplyScalar(4)), [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      lights.current?.setMatrixAt(i, m.makeTranslation(Math.cos(a) * (RADIUS + 0.35), -0.15, Math.sin(a) * (RADIUS + 0.35)))
      lights.current?.setColorAt(i, colors[i % colors.length])
    }
    if (lights.current) {
      lights.current.instanceMatrix.needsUpdate = true
      if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true
    }
  }, [colors])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(1, CHAIN, 1), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const t = fx.reduced ? 2 : clock.elapsedTime
    // цикл «разгон — полёт — торможение» за 20 секунд
    const phase = (Math.sin(t * 0.31) + 1) / 2
    const spin = t * 0.6 + Math.sin(t * 0.31) * 2
    const swing = 0.15 + phase * 0.55
    if (top.current) {
      top.current.rotation.y = spin
      top.current.rotation.z = Math.sin(t * 0.5) * 0.12 * phase
    }
    for (let i = 0; i < SEATS; i++) {
      const a = (i / SEATS) * Math.PI * 2
      e.set(0, -a, swing)
      q.setFromEuler(e)
      const ax = Math.cos(a) * RADIUS
      const az = Math.sin(a) * RADIUS
      const dx = Math.cos(a) * Math.sin(swing) * CHAIN
      const dy = -Math.cos(swing) * CHAIN
      const dz = Math.sin(a) * Math.sin(swing) * CHAIN
      m.compose(p.set(ax + dx / 2, dy / 2 - 0.2, az + dz / 2), q, s)
      chains.current?.setMatrixAt(i, m)
      m.compose(p.set(ax + dx, dy - 0.3, az + dz), q, one)
      seats.current?.setMatrixAt(i, m)
    }
    if (chains.current) chains.current.instanceMatrix.needsUpdate = true
    if (seats.current) seats.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <mesh position={[0, 3.3, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 6.6, 12]} />
        <meshStandardMaterial color="#d8d2c4" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={top} position={[0, 6.8, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[RADIUS + 0.5, 1.4, 24]} />
          <meshStandardMaterial color="#c2303a" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[RADIUS + 0.5, RADIUS + 0.5, 0.3, 24, 1, true]} />
          <meshStandardMaterial color="#f2e7cf" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <instancedMesh ref={lights} args={[undefined, undefined, 32]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={chains} args={[undefined, undefined, SEATS]} frustumCulled={false}>
          <cylinderGeometry args={[0.01, 0.01, 1, 3]} />
          <meshBasicMaterial color="#888" />
        </instancedMesh>
        <instancedMesh ref={seats} args={[undefined, undefined, SEATS]} frustumCulled={false}>
          <boxGeometry args={[0.36, 0.1, 0.36]} />
          <meshStandardMaterial color="#e2b13c" roughness={0.5} />
        </instancedMesh>
      </group>
    </group>
  )
}
