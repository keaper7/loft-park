'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SQUARE, TERRACE, TREES } from './layout'
import { paversTexture, planksTexture } from './textures'

/**
 * Площадь и терраса Loft Park: плитка, настил, маркизы на стальном
 * каркасе (с проёмами там, где сквозь крышу растут деревья), кашпо и
 * чёрный заборчик по фасаду, зелёный коврик у входа, плетёные кресла
 * с розовыми подушками, обогреватели-пирамиды, белые фонари-домики
 * и гирлянды-фестоны над площадью.
 */

const steel = new THREE.MeshStandardMaterial({ color: '#17171a', metalness: 0.7, roughness: 0.45 })

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** Провисающие гирлянды: пары точек → кривые → лампы одним инстансом */
function Festoons({ spans, per }: { spans: [number, number, number, number, number, number][]; per: number }) {
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const curves = useMemo(
    () =>
      spans.map(([ax, ay, az, bx, by, bz]) => {
        const A = new THREE.Vector3(ax, ay, az)
        const B = new THREE.Vector3(bx, by, bz)
        const sag = A.distanceTo(B) * 0.06
        const pts = Array.from({ length: 17 }, (_, i) => {
          const t = i / 16
          const p = A.clone().lerp(B, t)
          p.y -= 4 * sag * t * (1 - t)
          return p
        })
        return new THREE.CatmullRomCurve3(pts)
      }),
    [spans],
  )
  const points = useMemo(() => curves.flatMap((c) => Array.from({ length: per }, (_, i) => c.getPoint((i + 0.5) / per))), [curves, per])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    points.forEach((p, i) => bulbs.current?.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.07, p.z)))
    if (bulbs.current) bulbs.current.instanceMatrix.needsUpdate = true
  }, [points])
  return (
    <group>
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 32, 0.01, 3, false]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial color={[5.5, 3.4, 1.4]} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** Однотипная мебель — инстансами: одна геометрия, много матриц */
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

export function Pavilion({ quality }: { quality: 'high' | 'low' }) {
  const pavers = useMemo(() => paversTexture([9, 4]), [])
  const deck = useMemo(() => planksTexture([6, 4], false), [])
  const T = TERRACE
  const midZ = (T.zFront + T.zBack) / 2
  const DECK_Y = 0.2

  // Маркизы: сетка панелей, панель пропускается, если сквозь неё растёт дерево
  const awning = useMemo(() => {
    const cells: THREE.Matrix4[] = []
    const pw = 2.4
    const pd = 2.8
    for (let x = T.x0 + pw / 2; x < T.x1; x += pw) {
      for (let z = T.zFront - pd / 2; z > T.zBack; z -= pd) {
        if (TREES.some((t) => Math.abs(t.x - x) < 1.9 && Math.abs(t.z - z) < 2)) continue
        cells.push(mat([x, T.roofY, z], [pw - 0.06, 1, pd - 0.06]))
      }
    }
    return cells
  }, [T])

  const furniture = useMemo(() => {
    const r = seeded(9)
    const tables = [
      [-9.6, -74.8],
      [-9.6, -83],
      [-4, -83.6],
      [3.8, -75],
      [9.6, -74.8],
      [4.6, -84.3],
      // ближе к центру — видны в кадре входа, но в стороне от пути камеры
      [-4.4, -79.6],
      [4, -79.4],
    ]
    const tops: THREE.Matrix4[] = []
    const legs: THREE.Matrix4[] = []
    const bodies: THREE.Matrix4[] = []
    const backs: THREE.Matrix4[] = []
    const cushions: THREE.Matrix4[] = []
    tables.forEach(([x, z]) => {
      tops.push(mat([x, DECK_Y + 0.74, z], [1.2, 1, 0.8]))
      legs.push(mat([x, DECK_Y + 0.37, z], [1, 0.74, 1]))
      ;[0, Math.PI].forEach((a) => {
        const ry = a + (r() - 0.5) * 0.3
        const cx = x + Math.sin(a) * 0.95
        const cz = z + Math.cos(a) * 0.95
        bodies.push(mat([cx, DECK_Y + 0.24, cz], [1, 1, 1], ry))
        const bx = cx + Math.sin(a) * 0.3
        const bz = cz + Math.cos(a) * 0.3
        backs.push(mat([bx, DECK_Y + 0.62, bz], [1, 1, 1], ry))
        cushions.push(mat([cx, DECK_Y + 0.5, cz], [1, 1, 1], ry))
      })
    })
    return { tops, legs, bodies, backs, cushions }
  }, [])

  const geos = useMemo(
    () => ({
      panel: new THREE.BoxGeometry(1, 0.05, 1),
      top: new THREE.BoxGeometry(1, 0.05, 1),
      leg: new THREE.CylinderGeometry(0.05, 0.08, 1, 8),
      body: new THREE.BoxGeometry(0.72, 0.48, 0.66),
      back: new THREE.BoxGeometry(0.72, 0.5, 0.1),
      cushion: new THREE.BoxGeometry(0.62, 0.1, 0.56),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      awning: new THREE.MeshStandardMaterial({ color: '#d9ccb4', roughness: 0.9, side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.65 }),
      wicker: new THREE.MeshStandardMaterial({ color: '#9c8360', roughness: 1 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#d99a8c', roughness: 0.95 }),
      rib: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.95 }),
    }),
    [],
  )

  const planters = useMemo(() => {
    const out: number[] = []
    for (let x = T.x0 + 0.9; x < T.x1; x += 1.9) if (Math.abs(x) > T.entrance + 0.6) out.push(x)
    return out
  }, [T])

  const posts = [T.x0, -7.2, -T.entrance - 0.2, T.entrance + 0.2, 7.2, T.x1]

  const festoonSpans = useMemo<[number, number, number, number, number, number][]>(() => {
    const s: [number, number, number, number, number, number][] = [
      [T.x0, T.roofY - 0.1, T.zFront, -T.entrance, T.roofY - 0.1, T.zFront],
      [T.entrance, T.roofY - 0.1, T.zFront, T.x1, T.roofY - 0.1, T.zFront],
      [-12, 3.6, -62, -3.8, 3.4, -65.5],
      [-3.8, 3.4, -65.5, 11, 3.5, -60],
      [11, 3.5, -60, 16, 3.6, -70],
      [-3.8, 3.4, -65.5, -2, T.roofY - 0.1, T.zFront],
      [11, 3.5, -60, 7.2, T.roofY - 0.1, T.zFront],
      [-12, 3.6, -62, -7.2, T.roofY - 0.1, T.zFront],
      // под маркизами: ряды лампочек поперёк террасы
      [T.x0, T.roofY - 0.12, -76, T.x1, T.roofY - 0.12, -76],
      [T.x0, T.roofY - 0.12, -80.5, T.x1, T.roofY - 0.12, -80.5],
      [T.x0, T.roofY - 0.12, -85, T.x1, T.roofY - 0.12, -85],
    ]
    return s
  }, [T])

  return (
    <group>
      {/* площадь */}
      <mesh rotation-x={-Math.PI / 2} position={[(SQUARE.x0 + SQUARE.x1) / 2, 0.015, (SQUARE.zNear + SQUARE.zFar) / 2]}>
        <planeGeometry args={[SQUARE.x1 - SQUARE.x0, SQUARE.zNear - SQUARE.zFar]} />
        <meshStandardMaterial map={pavers} roughness={0.85} />
      </mesh>

      {/* настил террасы */}
      <mesh position={[0, DECK_Y / 2, midZ]}>
        <boxGeometry args={[T.x1 - T.x0, DECK_Y, T.zFront - T.zBack]} />
        <meshStandardMaterial map={deck} roughness={0.75} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, T.zFront + 1]}>
        <planeGeometry args={[2.2, 1.6]} />
        <meshStandardMaterial color="#2f6b2c" roughness={1} />
      </mesh>

      {/* каркас и маркизы */}
      {posts.map((x) => (
        <mesh key={x} position={[x, T.roofY / 2, T.zFront]} material={steel}>
          <boxGeometry args={[0.14, T.roofY, 0.14]} />
        </mesh>
      ))}
      {[T.zFront, T.zBack].map((z) => (
        <mesh key={z} position={[0, T.roofY + 0.05, z]} material={steel}>
          <boxGeometry args={[T.x1 - T.x0 + 0.2, 0.26, 0.18]} />
        </mesh>
      ))}
      {Array.from({ length: 11 }, (_, i) => T.x0 + i * 2.4).map((x) => (
        <mesh key={x} position={[x, T.roofY + 0.05, midZ]} material={mats.rib}>
          <boxGeometry args={[0.08, 0.12, T.zFront - T.zBack]} />
        </mesh>
      ))}
      <Instances items={awning} geometry={geos.panel} material={mats.awning} />

      {/* фасад: кашпо с кустами и цветами, чёрный заборчик */}
      {planters.map((x, i) => (
        <group key={x} position={[x, 0, T.zFront + 0.45]}>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[1.7, 0.64, 0.7]} />
            <meshStandardMaterial color="#6b4a30" roughness={0.8} />
          </mesh>
          {[-0.45, 0.1, 0.55].map((dx, k) => (
            <mesh key={dx} position={[dx, 0.85, 0]} scale={[0.5, 0.42, 0.4]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={k % 2 ? '#2c5a2a' : '#3b6e32'} roughness={1} />
            </mesh>
          ))}
          {quality === 'high' &&
            [-0.6, -0.2, 0.3, 0.65].map((dx, k) => (
              <mesh key={dx} position={[dx, 1.05 + (k % 2) * 0.1, 0.18]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                <meshStandardMaterial color={['#d8344a', '#f07aa0', '#f4f0e6', '#d8344a'][(k + i) % 4]} roughness={0.7} />
              </mesh>
            ))}
        </group>
      ))}
      {[
        [(T.x0 - T.entrance) / 2, T.x0 + T.entrance],
        [(T.x1 + T.entrance) / 2, T.x1 - T.entrance],
      ].map(([cx, w]) => (
        <mesh key={cx} position={[cx, 0.9, T.zFront - 0.05]} material={steel}>
          <boxGeometry args={[Math.abs(w), 0.05, 0.05]} />
        </mesh>
      ))}

      {/* кадки с деревцами на настиле */}
      {[
        [-4.2, -75.6],
        [2.6, -82.6],
      ].map(([x, z]) => (
        <group key={x} position={[x, DECK_Y, z]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color="#b9b6ae" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 1.2, 6]} />
            <meshStandardMaterial color="#4a3a2c" />
          </mesh>
          <mesh position={[0, 2.1, 0]} scale={[0.75, 0.65, 0.75]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#3f7434" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* мебель */}
      <Instances items={furniture.tops} geometry={geos.top} material={mats.wood} />
      <Instances items={furniture.legs} geometry={geos.leg} material={steel} />
      <Instances items={furniture.bodies} geometry={geos.body} material={mats.wicker} />
      <Instances items={furniture.backs} geometry={geos.back} material={mats.wicker} />
      <Instances items={furniture.cushions} geometry={geos.cushion} material={mats.cushion} />

      {/* обогреватели-пирамиды */}
      {[
        [-11.2, -79],
        [11.2, -79],
      ].map(([x, z]) => (
        <group key={x} position={[x, DECK_Y, z]}>
          <mesh position={[0, 1.15, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.36, 2.3, 4, 1, true]} />
            <meshStandardMaterial color="#1c1c1f" metalness={0.8} roughness={0.35} wireframe />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
            <meshBasicMaterial color={[5, 1.6, 0.35]} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.32, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.28, 0.25, 4]} />
            <meshStandardMaterial color="#1c1c1f" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* белые фонари-домики со свечой */}
      {[
        [-2.6, DECK_Y, -73],
        [2.6, DECK_Y, -73],
        [-11.3, DECK_Y, -85],
        [11.3, DECK_Y, -85.2],
        [-7.8, DECK_Y, -79.5],
      ].map(([x, y, z]) => (
        <group key={`${x}${z}`} position={[x, y, z]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.34, 0.6, 0.34]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.6} transparent opacity={0.88} />
          </mesh>
          <mesh position={[0, 0.72, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.3, 0.26, 4]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial color={[6, 3, 1]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Festoons spans={festoonSpans} per={quality === 'high' ? 14 : 8} />
      {/* Лампа ниже и в стороне от рёбер маркизы: под ребром на x=0 она
          давала яркий блик-полосу через весь кадр входа на террасу */}
      <pointLight position={[-3.5, 2.1, -80]} color="#ffb870" intensity={10} distance={12} decay={1.5} />
    </group>
  )
}
