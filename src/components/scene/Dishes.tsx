'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx, smoothstep } from './fx'
import { TABLE_Z } from './layout'

/**
 * Три блюда на общем столе — по одному на кухню. Каждое собрано из
 * простых примитивов («деталей»), и у каждой детали есть направление
 * разлёта. Когда камера подъезжает к блюду (fx.cam ≈ индекс кадра),
 * детали слетаются и складываются в блюдо; уезжает — блюдо снова
 * рассыпается на ингредиенты. Всё процедурно, без моделей.
 */

type Part = {
  geo: THREE.BufferGeometry
  mat: THREE.Material
  pos: [number, number, number]
  rot?: [number, number, number]
  scale?: [number, number, number]
  /** Подложка (доска, тарелка) не разлетается */
  fixed?: boolean
}

const TABLE_Y = 1.04

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })

function useKhachapuri(): Part[] {
  return useMemo(() => {
    const crust = std('#c9853a', { roughness: 0.75 })
    const parts: Part[] = [
      { geo: new THREE.BoxGeometry(1.5, 0.06, 0.8), mat: std('#6b4326', { roughness: 0.85 }), pos: [0, 0.03, 0], fixed: true },
      { geo: new THREE.TorusGeometry(0.42, 0.12, 14, 40), mat: crust, pos: [0, 0.17, 0], rot: [-Math.PI / 2, 0, 0], scale: [1, 0.46, 1] },
      { geo: new THREE.ConeGeometry(0.1, 0.3, 12), mat: crust, pos: [0.55, 0.17, 0], rot: [0, 0, -Math.PI / 2], scale: [1, 1, 0.8] },
      { geo: new THREE.ConeGeometry(0.1, 0.3, 12), mat: crust, pos: [-0.55, 0.17, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.8] },
      { geo: new THREE.CylinderGeometry(0.4, 0.4, 0.06, 40), mat: std('#f2c14e', { emissive: '#5a3a08', emissiveIntensity: 0.4, roughness: 0.4 }), pos: [0, 0.16, 0], scale: [1, 1, 0.42] },
      { geo: new THREE.SphereGeometry(0.17, 20, 12), mat: std('#fff4e0', { roughness: 0.3 }), pos: [0, 0.19, 0], scale: [1, 0.2, 0.62] },
      { geo: new THREE.SphereGeometry(0.085, 20, 14), mat: std('#ff9a1a', { emissive: '#ff5a00', emissiveIntensity: 0.35, roughness: 0.15 }), pos: [0, 0.22, 0], scale: [1, 0.7, 1] },
      { geo: new THREE.BoxGeometry(0.09, 0.07, 0.09), mat: std('#ffe7a0', { roughness: 0.3 }), pos: [0.2, 0.23, 0.03], rot: [0, 0.6, 0] },
    ]
    return parts
  }, [])
}

function useRolls(): Part[] {
  return useMemo(() => {
    const nori = std('#10201a', { roughness: 0.8 })
    const rice = std('#f4efe4', { roughness: 0.95 })
    const salmon = std('#ff7a48', { roughness: 0.35, emissive: '#5a1a00', emissiveIntensity: 0.2 })
    const r = seeded(5)
    const parts: Part[] = [
      { geo: new THREE.BoxGeometry(1.5, 0.05, 0.75), mat: std('#1c1e21', { roughness: 0.9 }), pos: [0, 0.025, 0], fixed: true },
    ]
    const rollNori = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 24)
    const rollRice = new THREE.CylinderGeometry(0.105, 0.105, 0.146, 24)
    const fish = new THREE.BoxGeometry(0.22, 0.035, 0.13)
    for (const x of [-0.42, -0.14, 0.14, 0.42]) {
      for (const z of [-0.14, 0.14]) {
        parts.push({ geo: rollNori, mat: nori, pos: [x, 0.12, z] })
        parts.push({ geo: rollRice, mat: rice, pos: [x, 0.12, z] })
        parts.push({ geo: fish, mat: salmon, pos: [x, 0.21, z], rot: [0, r() * 0.8 - 0.4, 0.05] })
      }
    }
    const chop = new THREE.CylinderGeometry(0.01, 0.014, 1.2, 6)
    const wood = std('#c8a27a')
    parts.push({ geo: chop, mat: wood, pos: [0, 0.07, 0.45], rot: [0, 0.05, Math.PI / 2] })
    parts.push({ geo: chop, mat: wood, pos: [0, 0.07, 0.5], rot: [0, -0.03, Math.PI / 2] })
    parts.push({ geo: new THREE.SphereGeometry(0.06, 12, 10), mat: std('#8fb04a'), pos: [0.62, 0.08, -0.2], scale: [1, 0.6, 1] })
    for (let i = 0; i < 3; i++) {
      parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), mat: std('#f7b8b0', { roughness: 0.3 }), pos: [0.62, 0.07 + i * 0.012, 0.12], rot: [0.3 * i, 0, 0.2] })
    }
    return parts
  }, [])
}

function useCarbonara(): Part[] {
  return useMemo(() => {
    const r = seeded(21)
    const parts: Part[] = [
      { geo: new THREE.CylinderGeometry(0.58, 0.5, 0.05, 48), mat: std('#efe7da', { roughness: 0.25 }), pos: [0, 0.025, 0], fixed: true },
      { geo: new THREE.TorusGeometry(0.55, 0.03, 8, 64), mat: std('#efe7da', { roughness: 0.25 }), pos: [0, 0.06, 0], rot: [-Math.PI / 2, 0, 0], fixed: true },
    ]
    const pasta = std('#f2cd78', { roughness: 0.5, emissive: '#3a2600', emissiveIntensity: 0.3 })
    for (let s = 0; s < 8; s++) {
      const pts: THREE.Vector3[] = []
      const off = r() * Math.PI * 2
      for (let k = 0; k < 36; k++) {
        const a = off + k * 0.55
        const rad = 0.06 + 0.24 * Math.abs(Math.sin(k * 0.21 + s))
        pts.push(new THREE.Vector3(Math.cos(a) * rad, 0.07 + k * 0.0045 + r() * 0.02, Math.sin(a) * rad))
      }
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.013, 6), mat: pasta, pos: [0, 0, 0] })
    }
    const bacon = std('#b04e2c', { roughness: 0.55 })
    const baconGeo = new THREE.BoxGeometry(0.065, 0.035, 0.05)
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2
      const d = r() * 0.25
      parts.push({ geo: baconGeo, mat: bacon, pos: [Math.cos(a) * d, 0.22 + r() * 0.04, Math.sin(a) * d], rot: [r(), r() * 3, r()] })
    }
    const cheese = std('#fff1c8', { roughness: 0.8 })
    const flake = new THREE.BoxGeometry(0.05, 0.006, 0.03)
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2
      const d = r() * 0.28
      parts.push({ geo: flake, mat: cheese, pos: [Math.cos(a) * d, 0.24 + r() * 0.04, Math.sin(a) * d], rot: [r(), r() * 3, r()] })
    }
    parts.push({ geo: new THREE.SphereGeometry(0.065, 18, 14), mat: std('#ffa21a', { roughness: 0.15, emissive: '#ff5a00', emissiveIntensity: 0.3 }), pos: [0, 0.27, 0], scale: [1, 0.75, 1] })
    return parts
  }, [])
}

function Dish({ parts, index, x }: { parts: Part[]; index: number; x: number }) {
  const group = useRef<THREE.Group>(null)
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const dirs = useMemo(() => {
    const r = seeded(100 + index)
    return parts.map(() => {
      // Разлёт вверх и от камеры (она стоит со стороны +z): детали летели
      // прямо в объектив и на пол-пути между блюдами закрывали полкадра
      const v = new THREE.Vector3(r() - 0.5, 0.5 + r() * 0.7, -(0.2 + r() * 0.6)).normalize()
      return { v, dist: 0.35 + r() * 0.8, spin: new THREE.Vector3(r() * 6 - 3, r() * 6 - 3, r() * 6 - 3) }
    })
  }, [parts, index])

  useFrame(({ clock }, dt) => {
    const e = smoothstep(0.1, 0.85, Math.abs(fx.cam - index))
    // Дальше кадра блюдо сворачивается и прячется: иначе в пролёте камеры
    // через зал (меню, DJ) над столом висели рассыпанные детали. Между
    // соседними блюдами (cam = 4.5) видны оба
    const far = smoothstep(0.75, 1.25, Math.abs(fx.cam - index))
    const t = clock.elapsedTime
    if (group.current) {
      group.current.visible = far < 0.999
      group.current.scale.setScalar(Math.max(0.001, 1 - far))
      if (!fx.reduced) group.current.rotation.y += dt * (0.18 + e * 0.4)
    }
    parts.forEach((p, i) => {
      const m = refs.current[i]
      if (!m || p.fixed) return
      const d = dirs[i]
      const bob = fx.reduced ? 0 : Math.sin(t * 1.4 + i) * 0.03 * e
      m.position.set(
        p.pos[0] + d.v.x * d.dist * e,
        p.pos[1] + d.v.y * d.dist * e + bob,
        p.pos[2] + d.v.z * d.dist * e,
      )
      const rot = p.rot ?? [0, 0, 0]
      m.rotation.set(rot[0] + d.spin.x * e, rot[1] + d.spin.y * e, rot[2] + d.spin.z * e)
    })
  })

  return (
    <group position={[x, TABLE_Y, TABLE_Z]}>
      <group ref={group}>
        {parts.map((p, i) => (
          <mesh
            key={i}
            geometry={p.geo}
            material={p.mat}
            position={p.pos}
            rotation={p.rot ?? [0, 0, 0]}
            scale={p.scale ?? [1, 1, 1]}
            ref={(el) => {
              refs.current[i] = el
            }}
          />
        ))}
      </group>
    </group>
  )
}

export function Dishes() {
  const khachapuri = useKhachapuri()
  const carbonara = useCarbonara()
  const rolls = useRolls()
  return (
    <group>
      <Dish parts={khachapuri} index={4} x={-3.6} />
      <Dish parts={carbonara} index={5} x={0} />
      <Dish parts={rolls} index={6} x={3.6} />
    </group>
  )
}
