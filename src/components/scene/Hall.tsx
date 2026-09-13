'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx, smoothstep } from './fx'
import { HALL, TABLE_Z } from './layout'
import { mossTexture, planksTexture } from './textures'
import { DJBooth } from './DJBooth'

/**
 * Закрытый зал Loft Park по фотографиям: светлый дощатый потолок со
 * стальными балками, люстры-грозди из янтарных стеклянных шаров,
 * тяжёлые красные шторы, коричневые кожаные диваны, зелёные бархатные
 * кресла, много растений и стена из живого мха с надписью LOFT PARK.
 * Сверху на крыше — маяк для финального вида-карты.
 */

const steel = new THREE.MeshStandardMaterial({ color: '#1b1b1e', metalness: 0.7, roughness: 0.45 })

/** Надпись на мху: светлые буквы и зелёный лист, как на стене зала */
function mossSignTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1024, 256)
  g.fillStyle = '#f5ecd9'
  g.shadowColor = 'rgba(255,220,160,0.9)'
  g.shadowBlur = 18
  g.font = '700 120px Unbounded, sans-serif'
  g.textBaseline = 'middle'
  g.textAlign = 'right'
  g.fillText('LOFT', 430, 130)
  g.textAlign = 'left'
  g.fillText('PARK', 594, 130)
  g.strokeStyle = '#f5ecd9'
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(512, 50)
  g.bezierCurveTo(575, 95, 575, 165, 512, 212)
  g.bezierCurveTo(449, 165, 449, 95, 512, 50)
  g.moveTo(512, 80)
  g.lineTo(512, 200)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Instances({ items, geometry, material }: { items: THREE.Matrix4[]; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    items.forEach((m, i) => ref.current?.setMatrixAt(i, m))
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} />
}

const mat = (p: [number, number, number], s: [number, number, number] = [1, 1, 1], ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(...s))

/** Одна «штора» со складками: плоскость, смещённая синусом */
function useCurtainGeometry(w: number, h: number) {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 32, 1)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 14) * 0.06)
    g.computeVertexNormals()
    return g
  }, [w, h])
}

export function Hall() {
  const H = HALL
  const cx = 0
  const cz = (H.zFront + H.zBack) / 2
  const depth = H.zFront - H.zBack
  const width = H.x1 - H.x0
  const ceiling = useMemo(() => planksTexture([6, 4], true), [])
  const floor = useMemo(() => planksTexture([6, 4], false), [])
  const moss = useMemo(() => mossTexture([4, 1.2]), [])
  const sign = useMemo(() => mossSignTexture(), [])
  const curtain = useCurtainGeometry(1.6, H.h - 0.1)
  const beacon = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  const chandeliers = useMemo(() => {
    const spots: [number, number][] = [
      [-6, -89],
      [6, -89],
      [-3.6, TABLE_Z],
      [3.6, TABLE_Z],
      [-6, -97.5],
      [6, -97.5],
    ]
    const balls: THREE.Matrix4[] = []
    const wires: THREE.Matrix4[] = []
    let s = 5
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    spots.forEach(([x, z]) => {
      wires.push(mat([x, H.h - 0.35, z], [1, 0.7, 1]))
      for (let k = 0; k < 11; k++) {
        const a = r() * Math.PI * 2
        const rad = r() * 0.32
        balls.push(mat([x + Math.cos(a) * rad, H.h - 0.8 - r() * 0.5, z + Math.sin(a) * rad], [1, 1, 1]))
      }
    })
    return { balls, wires, spots }
  }, [H.h])

  const seating = useMemo(() => {
    const booths: THREE.Matrix4[] = []
    const boothBacks: THREE.Matrix4[] = []
    const chairs: THREE.Matrix4[] = []
    const chairBacks: THREE.Matrix4[] = []
    const tables: THREE.Matrix4[] = []
    // диваны вдоль боковых стен
    for (const x of [H.x0 + 0.6, H.x1 - 0.6]) {
      for (const z of [-89, -94, -99]) {
        const ry = x < 0 ? Math.PI / 2 : -Math.PI / 2
        booths.push(mat([x, 0.28, z], [1, 1, 1], ry))
        boothBacks.push(mat([x + (x < 0 ? -0.33 : 0.33), 0.72, z], [1, 1, 1], ry))
        tables.push(mat([x + (x < 0 ? 1.1 : -1.1), 0.74, z], [1, 1, 1]))
        chairs.push(mat([x + (x < 0 ? 1.9 : -1.9), 0.25, z], [1, 1, 1], ry + Math.PI))
        chairBacks.push(mat([x + (x < 0 ? 2.2 : -2.2), 0.62, z], [1, 1, 1], ry + Math.PI))
      }
    }
    // зелёные кресла у общего стола
    for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) {
      chairs.push(mat([x, 0.25, TABLE_Z - 1.05], [1, 1, 1], 0))
      chairBacks.push(mat([x, 0.62, TABLE_Z - 1.35], [1, 1, 1], 0))
    }
    return { booths, boothBacks, chairs, chairBacks, tables }
  }, [H.x0, H.x1])

  const geos = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(0.11, 12, 10),
      wire: new THREE.CylinderGeometry(0.008, 0.008, 1, 3),
      booth: new THREE.BoxGeometry(2.4, 0.5, 0.8),
      boothBack: new THREE.BoxGeometry(2.4, 0.75, 0.2),
      chair: new THREE.BoxGeometry(0.58, 0.46, 0.56),
      chairBack: new THREE.BoxGeometry(0.58, 0.55, 0.1),
      table: new THREE.BoxGeometry(1.1, 0.05, 1.1),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      glass: new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9a3d', emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.85 }),
      leather: new THREE.MeshStandardMaterial({ color: '#5a3322', roughness: 0.45 }),
      velvet: new THREE.MeshStandardMaterial({ color: '#1f5a45', roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ color: '#9a6a40', roughness: 0.55 }),
      wire: new THREE.MeshBasicMaterial({ color: '#111' }),
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (beacon.current) {
      const v = smoothstep(9.2, 10.6, fx.cam)
      beacon.current.visible = v > 0.01
      beacon.current.scale.setScalar(0.4 + v * 0.6)
    }
    if (ring.current) {
      const p = (clock.elapsedTime * 0.6) % 1
      ring.current.scale.setScalar(1 + p * 3)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8
    }
  })

  const sideWall = (x: number) => (
    <mesh position={[x, H.h / 2, cz]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2}>
      <planeGeometry args={[depth, H.h]} />
      <meshStandardMaterial map={floor} color="#5a4636" roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  )

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.04, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      {/* потолок: светлые доски + балки; снаружи — тёмная крыша */}
      <mesh rotation-x={Math.PI / 2} position={[cx, H.h, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={ceiling} roughness={0.8} />
      </mesh>
      <mesh position={[cx, H.h + 0.18, cz]}>
        <boxGeometry args={[width + 0.4, 0.34, depth + 0.4]} />
        <meshStandardMaterial color="#1a1614" roughness={0.9} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => H.zFront - 1.6 - i * 3.2).map((z) => (
        <mesh key={z} position={[cx, H.h - 0.18, z]} material={steel}>
          <boxGeometry args={[width, 0.3, 0.2]} />
        </mesh>
      ))}

      {sideWall(H.x0)}
      {sideWall(H.x1)}

      {/* фасад к террасе: тёмные стойки и стекло по краям проёма */}
      {[
        [(H.x0 - H.opening) / 2, H.x0 + H.opening],
        [(H.x1 + H.opening) / 2, H.x1 - H.opening],
      ].map(([x, w]) => (
        <group key={x}>
          <mesh position={[x, H.h / 2, H.zFront]}>
            <planeGeometry args={[Math.abs(w), H.h]} />
            <meshBasicMaterial color="#ffc27a" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {[H.x0, -H.opening, H.opening, H.x1].map((x) => (
        <mesh key={x} position={[x, H.h / 2, H.zFront]} material={steel}>
          <boxGeometry args={[0.16, H.h, 0.16]} />
        </mesh>
      ))}
      {/* красные шторы у проёма и вдоль стёкол */}
      {[-H.opening + 0.8, H.opening - 0.8, -10.6, 10.6].map((x) => (
        <mesh key={x} geometry={curtain} position={[x, H.h / 2, H.zFront - 0.25]}>
          <meshStandardMaterial color="#a3161f" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* задняя стена: мох и надпись */}
      <mesh position={[cx, H.h / 2, H.zBack]}>
        <planeGeometry args={[width, H.h]} />
        <meshStandardMaterial color="#3b2b20" roughness={0.9} />
      </mesh>
      <mesh position={[cx, 2.25, H.zBack + 0.05]}>
        <planeGeometry args={[14, 2.6]} />
        <meshStandardMaterial map={moss} roughness={1} />
      </mesh>
      <mesh position={[cx, 2.7, H.zBack + 0.1]}>
        <planeGeometry args={[6, 1.5]} />
        <meshBasicMaterial map={sign} transparent color={[1.6, 1.5, 1.35]} toneMapped={false} depthWrite={false} />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 2.25, H.zBack + 0.08]}>
          <boxGeometry args={[0.2, 2.8, 0.1]} />
          <meshStandardMaterial color="#7a5234" roughness={0.6} />
        </mesh>
      ))}

      {/* общий стол для трёх блюд */}
      <mesh position={[0, 1.0, TABLE_Z]}>
        <boxGeometry args={[12, 0.08, 1.8]} />
        <meshStandardMaterial color="#b07a4a" roughness={0.5} />
      </mesh>
      {[-5.6, 5.6].map((x) => (
        <mesh key={x} position={[x, 0.5, TABLE_Z]} material={steel}>
          <boxGeometry args={[0.08, 1, 1.4]} />
        </mesh>
      ))}

      <Instances items={seating.booths} geometry={geos.booth} material={mats.leather} />
      <Instances items={seating.boothBacks} geometry={geos.boothBack} material={mats.leather} />
      <Instances items={seating.chairs} geometry={geos.chair} material={mats.velvet} />
      <Instances items={seating.chairBacks} geometry={geos.chairBack} material={mats.velvet} />
      <Instances items={seating.tables} geometry={geos.table} material={mats.wood} />
      <Instances items={chandeliers.balls} geometry={geos.ball} material={mats.glass} />
      <Instances items={chandeliers.wires} geometry={geos.wire} material={mats.wire} />

      {/* растения в кадках по углам */}
      {[
        [H.x0 + 0.8, H.zFront - 0.9],
        [H.x1 - 0.8, H.zFront - 0.9],
        [H.x0 + 0.8, H.zBack + 0.9],
        [H.x1 - 0.8, H.zBack + 0.9],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.35, 0.3, 0.7, 12]} />
            <meshStandardMaterial color="#2a2522" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.7) * 0.3, 1.1 + k * 0.35, Math.sin(k * 1.7) * 0.3]} scale={[0.55, 0.6, 0.55]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={k % 2 ? '#2f6a33' : '#3f7c3c'} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      <pointLight position={[0, 2.9, TABLE_Z + 0.5]} color="#ffb870" intensity={16} distance={10} decay={1.4} />
      <pointLight position={[-6, 2.8, -96]} color="#ffa552" intensity={12} distance={12} decay={1.4} />
      <pointLight position={[6, 2.8, -96]} color="#ffa552" intensity={12} distance={12} decay={1.4} />

      <DJBooth />

      <group ref={beacon} position={[0, H.h + 0.5, cz]} visible={false}>
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[0.12, 0.7, 12, 24, 1, true]} />
          <meshBasicMaterial color={[2.4, 1.4, 0.5]} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh ref={ring} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.6, 1.9, 48]} />
          <meshBasicMaterial color={[3, 1.8, 0.6]} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
