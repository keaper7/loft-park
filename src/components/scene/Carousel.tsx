'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'
import { RIDES } from './layout'
import { striped } from './Attractions'
import { glowTexture } from './textures'

const SEATS = 16
const RADIUS = 3.2
const CHAIN = 2.4
const TOWER = 7.4

/**
 * Цепочная карусель парка аттракционов — стоит у Главной аллеи, справа от
 * пути к Loft Park; на фото гостей её красно-белый купол виден за буквами.
 * Сиденья разлетаются наружу по мере раскрутки; огни по кругу бегут.
 */
export function Carousel() {
  const { x, z } = RIDES.swing
  const top = useRef<THREE.Group>(null)
  const chains = useRef<THREE.InstancedMesh>(null)
  const seats = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const colors = useMemo(() => ['#ffb561', '#ff4f9a', '#6fd3ff', '#f4f0e6'].map((c) => new THREE.Color(c).multiplyScalar(4)), [])
  const seatColors = useMemo(() => ['#e2b13c', '#d8343c', '#2f7fd1', '#3aa35a'].map((c) => new THREE.Color(c)), [])
  const geos = useMemo(
    () => ({
      canopy: striped(new THREE.ConeGeometry(RADIUS + 0.6, 1.6, 32, 1, true), 32, ['#c8202c', '#f4efe4']),
      band: striped(new THREE.CylinderGeometry(RADIUS + 0.6, RADIUS + 0.6, 0.45, 32, 1, true), 32, ['#f4efe4', '#c8202c']),
    }),
    [],
  )
  const glow = useMemo(() => glowTexture(), [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      lights.current?.setMatrixAt(i, m.makeTranslation(Math.cos(a) * (RADIUS + 0.65), -0.25, Math.sin(a) * (RADIUS + 0.65)))
      lights.current?.setColorAt(i, colors[i % colors.length])
    }
    if (lights.current) {
      lights.current.instanceMatrix.needsUpdate = true
      if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true
    }
    for (let i = 0; i < SEATS; i++) seats.current?.setColorAt(i, seatColors[i % seatColors.length])
    if (seats.current?.instanceColor) seats.current.instanceColor.needsUpdate = true
  }, [colors, seatColors])

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
      m.compose(p.set(ax + dx / 2, dy / 2 - 0.3, az + dz / 2), q, s)
      chains.current?.setMatrixAt(i, m)
      m.compose(p.set(ax + dx, dy - 0.4, az + dz), q, one)
      seats.current?.setMatrixAt(i, m)
    }
    if (chains.current) chains.current.instanceMatrix.needsUpdate = true
    if (seats.current) seats.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.4, 1.6, 0.3, 20]} />
        <meshStandardMaterial color="#c9c2b4" roughness={0.7} />
      </mesh>
      <mesh position={[0, TOWER / 2, 0]}>
        <cylinderGeometry args={[0.32, 0.55, TOWER, 12]} />
        <meshStandardMaterial color="#e0d9cb" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={top} position={[0, TOWER + 0.2, 0]}>
        <mesh position={[0, 0.55, 0]} geometry={geos.canopy}>
          <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.05, 0]} geometry={geos.band}>
          <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <instancedMesh ref={lights} args={[undefined, undefined, 40]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={chains} args={[undefined, undefined, SEATS]} frustumCulled={false}>
          <cylinderGeometry args={[0.012, 0.012, 1, 3]} />
          <meshBasicMaterial color="#999" />
        </instancedMesh>
        <instancedMesh ref={seats} args={[undefined, undefined, SEATS]} frustumCulled={false}>
          <boxGeometry args={[0.4, 0.1, 0.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </instancedMesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}>
        <planeGeometry args={[15, 15]} />
        <meshBasicMaterial map={glow} color="#ffc6e0" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
