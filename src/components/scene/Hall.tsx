'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx, smoothstep } from './fx'
import { HALL, TABLE_Z } from './layout'
import { brickTexture, herringboneTexture, mossTexture, planksTexture } from './textures'
import { buildWord, useEmblem } from './LoftSign'
import { DJBooth } from './DJBooth'
import { Instances, mat, seeded } from './instancing'

/**
 * Закрытый зал Loft Park по фотографиям гостей:
 * - тёмный потолок-«короб» с зелёной светодиодной подсветкой по периметру;
 * - во всю заднюю стену — живой мох с серебристыми объёмными буквами
 *   LOFT [лист] PARK, ниже — деревянные панели;
 * - серые мягкие диваны вдоль стен, столы «ёлочкой», бирюзовые и пудровые
 *   бархатные кресла;
 * - люстры: чугунные кольца со свечами, зелёные стеклянные шары, деревянные
 *   «барабаны»;
 * - чёрные металлические стеллажи с зелёными бутылками и растениями;
 * - барная стойка с кирпичным фасадом и подсвеченными полками;
 * - к террасе — стекло в чёрных рамах и тяжёлые красные шторы.
 * Сверху на крыше — маяк для финального вида-карты.
 */

const steel = new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.5, roughness: 0.5 })

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

const COVE = 0.9

export function Hall() {
  const H = HALL
  const cz = (H.zFront + H.zBack) / 2
  const depth = H.zFront - H.zBack
  const width = H.x1 - H.x0
  const beacon = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const curtain = useCurtainGeometry(1.6, H.h - 0.1)

  const tex = useMemo(() => {
    const herring = herringboneTexture()
    const longHerring = herring.clone()
    longHerring.wrapS = longHerring.wrapT = THREE.RepeatWrapping
    longHerring.repeat.set(9, 1.4)
    longHerring.needsUpdate = true
    return {
      floor: planksTexture([6, 4], true),
      wall: planksTexture([5, 1.4], false),
      wainscot: planksTexture([8, 1], false),
      moss: mossTexture([7, 0.9]),
      brick: brickTexture([3, 0.7]),
      herring,
      longHerring,
    }
  }, [])

  const loftWord = useMemo(() => buildWord('LOFT', 0.62, 0.135, 0.08, 0.04), [])
  const parkWord = useMemo(() => buildWord('PARK', 0.62, 0.135, 0.08, 0.04), [])
  const emblem = useEmblem(0.8, 0.44)

  const mats = useMemo(
    () => ({
      silver: new THREE.MeshStandardMaterial({ color: '#e8e6e0', metalness: 0.45, roughness: 0.35, emissive: '#4a4a46', emissiveIntensity: 0.9 }),
      fabric: new THREE.MeshStandardMaterial({ color: '#7d7874', roughness: 1 }),
      velvet: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
      tableTop: new THREE.MeshStandardMaterial({ map: tex.herring, roughness: 0.5 }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.7 }),
      wire: new THREE.MeshBasicMaterial({ color: '#111' }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.5), toneMapped: false }),
      candle: new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.6 }),
      bottle: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
      green: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 1.5, 0.36), toneMapped: false }),
      soffit: new THREE.MeshStandardMaterial({ color: '#1b1e1c', roughness: 0.9 }),
      leather: new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.5 }),
      shelfGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2, 0.9), toneMapped: false }),
    }),
    [tex],
  )

  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
      ring: new THREE.TorusGeometry(0.42, 0.022, 6, 32),
      bulb: new THREE.SphereGeometry(1, 10, 8),
      leaf: new THREE.IcosahedronGeometry(1, 0),
      // кресло-«ракушка»: чаша-спинка из части сферы, проём смотрит в +z
      shell: new THREE.SphereGeometry(0.34, 16, 10, -Math.PI * 0.75, Math.PI * 1.5, Math.PI * 0.3, Math.PI * 0.35).rotateY(-Math.PI / 2),
    }),
    [],
  )

  // ── мягкая мебель ──
  const seating = useMemo(() => {
    const palette = ['#1f5f5a', '#1f5f5a', '#d9b1a8', '#2a6e66'].map((c) => new THREE.Color(c))
    const out = {
      booths: [] as THREE.Matrix4[],
      backs: [] as THREE.Matrix4[],
      tables: [] as THREE.Matrix4[],
      legs: [] as THREE.Matrix4[],
      seats: [] as THREE.Matrix4[],
      shells: [] as THREE.Matrix4[],
      chairColors: [] as THREE.Color[],
    }
    const chair = (x: number, z: number, ry: number, k: number) => {
      out.seats.push(mat([x, 0.44, z], [0.28, 0.1, 0.28], ry))
      out.shells.push(mat([x, 0.5, z], [1, 1, 1], ry))
      out.legs.push(mat([x, 0.2, z], [0.025, 0.4, 0.025]))
      out.chairColors.push(palette[k % palette.length])
    }
    const rows: [number, number[]][] = [
      [H.x0 + 0.6, [-89, -94, -99]],
      // справа у дальней стены — бар
      [H.x1 - 0.6, [-89, -94]],
    ]
    let k = 0
    for (const [x, zs] of rows) {
      const inward = x < 0 ? 1 : -1
      for (const z of zs) {
        const ry = x < 0 ? Math.PI / 2 : -Math.PI / 2
        out.booths.push(mat([x, 0.26, z], [0.8, 0.52, 2.4]))
        out.backs.push(mat([x - inward * 0.34, 0.78, z], [0.2, 0.62, 2.4]))
        out.tables.push(mat([x + inward * 1.15, 0.74, z], [1.1, 0.05, 1.1]))
        out.legs.push(mat([x + inward * 1.15, 0.37, z], [0.05, 0.74, 0.05]))
        chair(x + inward * 2.05, z - 0.35, ry + Math.PI, k++)
        chair(x + inward * 2.05, z + 0.35, ry + Math.PI, k++)
      }
    }
    // кресла у общего стола — лицом к камере на блюдах
    for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) chair(x, TABLE_Z - 1.05, 0, k++)
    return out
  }, [H.x0, H.x1])

  // ── свет: люстры-кольца, зелёные шары, деревянные барабаны ──
  const lamps = useMemo(() => {
    const out = { rings: [] as THREE.Matrix4[], candles: [] as THREE.Matrix4[], bulbs: [] as THREE.Matrix4[], wires: [] as THREE.Matrix4[] }
    const wire = (x: number, z: number, y: number) => {
      const len = H.h - 0.3 - y
      out.wires.push(mat([x, y + len / 2, z], [0.008, len, 0.008]))
    }
    for (const [x, z] of [
      [H.x0 + 1.75, -89],
      [H.x0 + 1.75, -94],
      [H.x0 + 1.75, -99],
      [H.x1 - 1.75, -89],
      [H.x1 - 1.75, -94],
    ]) {
      const y = 2.75
      out.rings.push(mat([x, y, z], [1, 1, 1], 0, Math.PI / 2))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const cx = x + Math.cos(a) * 0.42
        const czz = z + Math.sin(a) * 0.42
        out.candles.push(mat([cx, y + 0.08, czz], [0.03, 0.14, 0.03]))
        out.bulbs.push(mat([cx, y + 0.2, czz], [0.045, 0.06, 0.045]))
      }
      // четыре цепи к кольцу сходятся в одну
      wire(x, z, y + 0.5)
    }
    return out
  }, [H.h, H.x0, H.x1])

  // Светильники висят в ≥ 1 м от пролётов камеры 6 → 7 и 7 → 8 (keyframes.ts)
  const globes: [number, number][] = [
    [-1.8, TABLE_Z],
    [1.8, TABLE_Z],
    [-5.6, -90.9],
    [5.6, -90.9],
  ]
  const drums: [number, number][] = [
    [0, -87.2],
    [-6.2, -96],
  ]

  // ── стеллажи с бутылками и зеленью ──
  const shelving = useMemo(() => {
    const r = seeded(19)
    const out = { frames: [] as THREE.Matrix4[], boards: [] as THREE.Matrix4[], bottles: [] as THREE.Matrix4[], bottleColors: [] as THREE.Color[], leaves: [] as THREE.Matrix4[], leafColors: [] as THREE.Color[] }
    const bottlePalette = ['#1f7a3c', '#2a8a47', '#175c2e', '#b86a2a', '#d9cfb8'].map((c) => new THREE.Color(c))
    // тёмная зелень: в тёплом свете зала светлые оттенки уходили в жёлтый
    const leafPalette = ['#2c5a28', '#3b6b32', '#234822', '#46743a'].map((c) => new THREE.Color(c))
    const unit = (cx: number, cz: number, w: number, d: number, alongZ: boolean, levels: number[], bottlesOnly = false) => {
      const px = alongZ ? d / 2 : w / 2
      const pz = alongZ ? w / 2 : d / 2
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.frames.push(mat([cx + sx * px, 1.25, cz + sz * pz], [0.04, 2.5, 0.04]))
      levels.forEach((y, li) => {
        out.boards.push(mat([cx, y, cz], alongZ ? [d, 0.03, w] : [w, 0.03, d]))
        const count = Math.round(w / 0.16)
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count - 0.5
          const [x, z] = alongZ ? [cx + (r() - 0.5) * d * 0.4, cz + t * w] : [cx + t * w, cz + (r() - 0.5) * d * 0.4]
          if (bottlesOnly || (li + i) % 3 !== 0) {
            const h = 0.26 + r() * 0.12
            out.bottles.push(mat([x, y + h / 2 + 0.02, z], [0.04, h, 0.04]))
            out.bottleColors.push(bottlePalette[Math.floor(r() * (bottlesOnly ? 5 : 3))])
          } else {
            const s = 0.14 + r() * 0.1
            out.leaves.push(mat([x, y + s, z], [s, s, s], r() * 3))
            out.leafColors.push(leafPalette[Math.floor(r() * leafPalette.length)])
            // плети свисают с полки
            out.leaves.push(mat([x + (r() - 0.5) * 0.1, y - 0.18, z], [0.07, 0.16, 0.07], r() * 3))
            out.leafColors.push(leafPalette[Math.floor(r() * leafPalette.length)])
          }
        }
      })
    }
    unit(-4.6, -97.8, 2.4, 0.36, false, [0.12, 0.7, 1.28, 1.86, 2.44])
    unit(4.6, -97.8, 2.4, 0.36, false, [0.12, 0.7, 1.28, 1.86, 2.44])
    // полки за барной стойкой
    unit(H.x1 - 0.25, -98.4, 5.2, 0.3, true, [1.45, 1.95, 2.45], true)
    return out
  }, [H.x1])

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
      <meshStandardMaterial map={tex.wall} color="#8a6a50" roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  )

  // Буквы на мху: LOFT, лист, PARK — по центру над DJ-пультом
  const EMB_W = 0.44
  const GAP = 0.2
  const signW = loftWord.width + GAP + EMB_W + GAP + parkWord.width
  const signX = -signW / 2
  const SIGN_Y = 2.2

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={tex.floor} color="#b5a898" roughness={0.6} />
      </mesh>

      {/* потолок-короб: тёмная середина, опущенный край, зелёная подсветка */}
      <mesh rotation-x={Math.PI / 2} position={[0, H.h, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#232826" roughness={0.9} />
      </mesh>
      <mesh position={[0, H.h + 0.18, cz]}>
        <boxGeometry args={[width + 0.6, 0.34, depth + 0.6]} />
        <meshStandardMaterial color="#1a1614" roughness={0.9} />
      </mesh>
      {[
        [0, H.zFront - COVE / 2, width, COVE],
        [0, H.zBack + COVE / 2, width, COVE],
        [H.x0 + COVE / 2, cz, COVE, depth - COVE * 2],
        [H.x1 - COVE / 2, cz, COVE, depth - COVE * 2],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}${z}`} position={[x, H.h - 0.14, z]} material={mats.soffit}>
          <boxGeometry args={[w, 0.28, d]} />
        </mesh>
      ))}
      {[
        [0, H.zFront - COVE, width - COVE * 2, 0.04],
        [0, H.zBack + COVE, width - COVE * 2, 0.04],
        [H.x0 + COVE, cz, 0.04, depth - COVE * 2],
        [H.x1 - COVE, cz, 0.04, depth - COVE * 2],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}${z}`} position={[x, H.h - 0.26, z]} material={mats.green}>
          <boxGeometry args={[w, 0.03, d]} />
        </mesh>
      ))}

      {sideWall(H.x0)}
      {sideWall(H.x1)}

      {/* фасад к террасе: стекло в чёрных рамах по краям проёма */}
      {[
        [(H.x0 - H.opening) / 2, H.x0 + H.opening],
        [(H.x1 + H.opening) / 2, H.x1 - H.opening],
      ].map(([x, w]) => (
        <mesh key={x} position={[x, H.h / 2, H.zFront]}>
          <planeGeometry args={[Math.abs(w), H.h]} />
          <meshBasicMaterial color="#ffc27a" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {[H.x0, -9.6, -H.opening, H.opening, 9.6, H.x1].map((x) => (
        <mesh key={x} position={[x, H.h / 2, H.zFront]} material={steel}>
          <boxGeometry args={[0.14, H.h, 0.14]} />
        </mesh>
      ))}
      <mesh position={[0, H.h - 0.1, H.zFront]} material={steel}>
        <boxGeometry args={[width, 0.2, 0.16]} />
      </mesh>
      {/* красные шторы вдоль стёкол, за краем проёма: внутри проёма штора
          закрывала треть кадра, когда камера выходит из зала к шатру */}
      {[-H.opening - 0.9, H.opening + 0.9, -10.6, 10.6].map((x) => (
        <mesh key={x} geometry={curtain} position={[x, H.h / 2, H.zFront - 0.25]}>
          <meshStandardMaterial color="#a3161f" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* задняя стена: деревянные панели внизу, мох во всю ширину */}
      <mesh position={[0, 0.6, H.zBack + 0.03]}>
        <planeGeometry args={[width, 1.2]} />
        <meshStandardMaterial map={tex.wainscot} color="#b0835a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.2 + (H.h - 1.2 - 0.28) / 2, H.zBack + 0.05]}>
        <planeGeometry args={[width, H.h - 1.2 - 0.28]} />
        <meshStandardMaterial map={tex.moss} roughness={1} />
      </mesh>
      <mesh geometry={loftWord.geo} material={mats.silver} position={[signX, SIGN_Y, H.zBack + 0.06]} />
      <mesh geometry={parkWord.geo} material={mats.silver} position={[signX + loftWord.width + GAP * 2 + EMB_W, SIGN_Y, H.zBack + 0.06]} />
      <group position={[signX + loftWord.width + GAP + EMB_W / 2, SIGN_Y + 0.31, H.zBack + 0.06]}>
        <mesh geometry={emblem.rings} material={mats.silver} />
        <mesh geometry={emblem.vein} material={mats.silver} />
      </group>
      {/* трековые светильники над буквами */}
      <mesh position={[0, H.h - 0.32, H.zBack + 0.5]} material={steel}>
        <boxGeometry args={[7, 0.05, 0.05]} />
      </mesh>
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((x) => (
        <mesh key={x} position={[x, H.h - 0.45, H.zBack + 0.42]} rotation-x={0.6} material={steel}>
          <cylinderGeometry args={[0.06, 0.05, 0.2, 10]} />
        </mesh>
      ))}

      {/* общий стол для трёх блюд */}
      <mesh position={[0, 1.0, TABLE_Z]}>
        <boxGeometry args={[12, 0.08, 1.8]} />
        <meshStandardMaterial map={tex.longHerring} roughness={0.5} />
      </mesh>
      {[-5.6, 5.6].map((x) => (
        <mesh key={x} position={[x, 0.5, TABLE_Z]} material={steel}>
          <boxGeometry args={[0.08, 1, 1.4]} />
        </mesh>
      ))}

      <Instances items={seating.booths} geometry={geos.box} material={mats.fabric} />
      <Instances items={seating.backs} geometry={geos.box} material={mats.fabric} />
      <Instances items={seating.tables} geometry={geos.box} material={mats.tableTop} />
      <Instances items={seating.legs} geometry={geos.cyl} material={steel} />
      <Instances items={seating.seats} geometry={geos.cyl} material={mats.velvet} colors={seating.chairColors} />
      <Instances items={seating.shells} geometry={geos.shell} material={mats.velvet} colors={seating.chairColors} />

      {/* люстры-кольца со свечами */}
      <Instances items={lamps.rings} geometry={geos.ring} material={steel} />
      <Instances items={lamps.candles} geometry={geos.cyl} material={mats.candle} />
      <Instances items={lamps.bulbs} geometry={geos.bulb} material={mats.bulb} />
      <Instances items={lamps.wires} geometry={geos.cyl} material={mats.wire} />
      {/* зелёные стеклянные шары */}
      {globes.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 2.72, z]}>
          <mesh position={[0, (H.h - 0.3 - 2.72) / 2 + 0.2, 0]} material={mats.wire}>
            <cylinderGeometry args={[0.008, 0.008, H.h - 0.3 - 2.72, 3]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.27, 20, 14]} />
            <meshStandardMaterial color="#6fae62" emissive="#2f7a2a" emissiveIntensity={1.1} roughness={0.1} transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh scale={[0.06, 0.09, 0.06]} material={mats.bulb} geometry={geos.bulb} />
        </group>
      ))}
      {/* деревянные «барабаны» */}
      {drums.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 2.9, z]}>
          <mesh position={[0, 0.35, 0]} material={mats.wire}>
            <cylinderGeometry args={[0.008, 0.008, 0.5, 3]} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.6, 0.6, 0.2, 28, 1, true]} />
            <meshStandardMaterial color="#9b6a3c" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.08, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.58, 28]} />
            <meshBasicMaterial color={[2.6, 1.8, 0.9]} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* стеллажи */}
      <Instances items={shelving.frames} geometry={geos.box} material={steel} />
      <Instances items={shelving.boards} geometry={geos.box} material={steel} />
      <Instances items={shelving.bottles} geometry={geos.cyl} material={mats.bottle} colors={shelving.bottleColors} />
      <Instances items={shelving.leaves} geometry={geos.leaf} material={mats.leaf} colors={shelving.leafColors} />

      {/* бар: кирпичный фасад, деревянная столешница, подсветка полок, стулья */}
      <group position={[H.x1 - 1.8, 0, -98.4]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.8, 1.1, 5.6]} />
          <meshStandardMaterial color="#2a1a13" roughness={0.9} />
        </mesh>
        <mesh position={[-0.41, 0.55, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[5.6, 1.1]} />
          <meshStandardMaterial map={tex.brick} roughness={0.9} />
        </mesh>
        <mesh position={[-0.05, 1.13, 0]} material={mats.darkWood}>
          <boxGeometry args={[1.05, 0.06, 5.8]} />
        </mesh>
        <mesh position={[-0.43, 0.08, 0]} material={mats.shelfGlow}>
          <boxGeometry args={[0.02, 0.02, 5.6]} />
        </mesh>
        {[-2, -0.7, 0.6, 1.9].map((z) => (
          <group key={z} position={[-1, 0, z]}>
            <mesh position={[0, 0.38, 0]} material={steel}>
              <cylinderGeometry args={[0.025, 0.04, 0.76, 6]} />
            </mesh>
            <mesh position={[0, 0.78, 0]} material={mats.leather}>
              <cylinderGeometry args={[0.2, 0.18, 0.08, 14]} />
            </mesh>
          </group>
        ))}
      </group>
      {[1.44, 1.94, 2.44].map((y) => (
        <mesh key={y} position={[H.x1 - 0.12, y - 0.03, -98.4]} material={mats.shelfGlow}>
          <boxGeometry args={[0.02, 0.02, 5.2]} />
        </mesh>
      ))}

      {/* растения в кадках по углам */}
      {[
        [H.x0 + 0.8, H.zFront - 0.9],
        [H.x1 - 0.8, H.zFront - 0.9],
        [H.x0 + 0.8, H.zBack + 0.9],
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
      <pointLight position={[8.4, 2.6, -97.5]} color="#ffa552" intensity={12} distance={12} decay={1.4} />

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
