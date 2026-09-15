'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fx, smoothstep } from './fx'
import { HALL, TABLE_Z } from './layout'
import {
  brickTexture,
  carvedScreenTexture,
  concreteTexture,
  coveGlowTexture,
  glowTexture,
  herringboneTexture,
  mossTexture,
  planksTexture,
} from './textures'
import { buildWord, useEmblem } from './LoftSign'
import { DJBooth } from './DJBooth'
import { Instances, mat, seeded } from './instancing'
import { crownGeometry, foliageMaterial, puffGeometry } from './foliage'

/**
 * Закрытый зал Loft Park по фотографиям гостей:
 * - потолок-короб: тёмно-зелёная середина, опущенный край из серой
 *   штукатурки, по его кромке — светодиодная лента с жёлто-зелёной засветкой;
 * - задняя стена — живой мох с серебристыми буквами LOFT [лист] PARK,
 *   под ним грубые деревянные панели, над буквами трек со спотами и
 *   чугунная люстра-клетка с лампами Эдисона; прямо под буквами — длинный
 *   серый диван с подушками и столами «ёлочкой», DJ-пульт — в углу;
 * - по залу — плотная посадка: столы на четверых с бирюзовыми и пудровыми
 *   креслами, общий стол из трёх сдвинутых столов для большой компании;
 * - вдоль стен — окна с длинными шторами и кирпичные колонны; под окнами
 *   бежевые диваны с узорными подушками, столы «ёлочкой» на чёрных ножках,
 *   бирюзовые и пудровые кресла-«ракушки» на тонких ножках;
 * - светильники: деревянные «барабаны» из реек, стеклянные шары — янтарные
 *   и зелёные, у бара — люстра из янтарных «лепестков»;
 * - стеллажи до потолка с зелёными бутылками, книгами, зеленью и плющом;
 * - резная деревянная ширма у входа, бар с кирпичным фасадом, подсвеченными
 *   полками и рыжими кожаными стульями;
 * - к террасе — стекло в чёрных рамах и тяжёлые красные шторы.
 * Сверху на крыше — маяк для финального вида-карты.
 */

const steel = new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.5, roughness: 0.5 })

/** Мягкий диван: цоколь, сиденье, спинка, подлокотники. Спинка — у локального −z */
function sofaGeometry(w: number) {
  return mergeGeometries([
    new THREE.BoxGeometry(w, 0.3, 0.86).translate(0, 0.15, 0),
    new THREE.BoxGeometry(w - 0.36, 0.16, 0.64).translate(0, 0.38, 0.07),
    new THREE.BoxGeometry(w, 0.64, 0.24).translate(0, 0.62, -0.31),
    new THREE.BoxGeometry(0.18, 0.52, 0.86).translate(-w / 2 + 0.09, 0.46, 0),
    new THREE.BoxGeometry(0.18, 0.52, 0.86).translate(w / 2 - 0.09, 0.46, 0),
  ])!
}

/** Кресло-«ракушка»: чаша-спинка проёмом к +z и круглое сиденье */
function armchairGeometry() {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.33, 0.27, 0.42, 20, 1, true, Math.PI * 0.35, Math.PI * 1.3).translate(0, 0.7, -0.02),
    new THREE.CylinderGeometry(0.29, 0.27, 0.13, 20).translate(0, 0.49, 0.02),
  ])!
}

/** Четыре тонкие ножки, чуть разведённые наружу */
function chairLegsGeometry() {
  return mergeGeometries(
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([sx, sz]) => new THREE.CylinderGeometry(0.014, 0.011, 0.46, 5).rotateZ(-sx * 0.14).rotateX(sz * 0.14).translate(sx * 0.19, 0.22, sz * 0.19)),
  )!
}

/** Штора со складками */
function curtainGeometry(w: number, h: number, folds = 10) {
  const g = new THREE.PlaneGeometry(w, h, 28, 1)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * folds) * 0.05)
  g.computeVertexNormals()
  return g
}

/** Смещение в локальных координатах предмета, повёрнутого на θ вокруг Y */
const place = (x: number, z: number, theta: number, lx: number, ly: number, lz: number): [number, number, number] => [
  x + lx * Math.cos(theta) + lz * Math.sin(theta),
  ly,
  z - lx * Math.sin(theta) + lz * Math.cos(theta),
]

const COVE = 1

export function Hall() {
  const H = HALL
  const cz = (H.zFront + H.zBack) / 2
  const depth = H.zFront - H.zBack
  const width = H.x1 - H.x0
  const beacon = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  const tex = useMemo(() => {
    const herring = herringboneTexture()
    const longHerring = herring.clone()
    longHerring.wrapS = longHerring.wrapT = THREE.RepeatWrapping
    longHerring.repeat.set(3, 0.9)
    longHerring.needsUpdate = true
    return {
      floor: planksTexture([5, 7], true),
      wall: planksTexture([5, 1.4], false),
      wainscot: planksTexture([10, 1.2], false),
      moss: mossTexture([7, 0.9]),
      brick: brickTexture([0.5, 2.4]),
      plaster: concreteTexture(),
      cove: coveGlowTexture(),
      spot: glowTexture(),
      screen: carvedScreenTexture(),
      herring,
      longHerring,
    }
  }, [])

  const loftWord = useMemo(() => buildWord('LOFT', 0.62, 0.135, 0.08, 0.04), [])
  const parkWord = useMemo(() => buildWord('PARK', 0.62, 0.135, 0.08, 0.04), [])
  const emblem = useEmblem(0.8, 0.44)

  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
      ball: new THREE.SphereGeometry(1, 14, 10),
      leaf: puffGeometry(),
      plantCrown: crownGeometry(21, 4, 1),
      sofa: sofaGeometry(2.3),
      longSofa: sofaGeometry(4.2),
      armchair: armchairGeometry(),
      legs: chairLegsGeometry(),
      // стол на двух наклонных опорах-трапециях
      tableLegs: mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.05, 0.72, 0.55).translate(s * 0.42, 0.36, 0)))!,
      // секция общего стола: четыре тонкие стальные ножки по углам — на крупных
      // планах блюд опоры-трапеции читались тёмными плитами под столешницей
      sectionLegs: mergeGeometries([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.BoxGeometry(0.045, 0.71, 0.045).translate(sx * 1.66, 0.355, sz * 0.6))))!,
      window: curtainGeometry(0.9, 3.1),
      frontCurtain: curtainGeometry(1.6, H.h - 0.1, 14),
    }),
    [H.h],
  )

  const mats = useMemo(
    () => ({
      silver: new THREE.MeshStandardMaterial({ color: '#e8e6e0', metalness: 0.45, roughness: 0.35, emissive: '#4a4a46', emissiveIntensity: 0.9 }),
      fabric: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      velvet: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }),
      tableTop: new THREE.MeshStandardMaterial({ map: tex.herring, roughness: 0.5 }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.7 }),
      wire: new THREE.MeshBasicMaterial({ color: '#111' }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.5), toneMapped: false }),
      bottle: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      foliage: foliageMaterial({ color: '#4d8a44' }),
      plain: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
      // Яркость на пороге bloom: лента читается светящейся, но у камеры
      // кадра 7 (она прямо под лентой) не разливается зелёным пятном в полэкрана
      cove: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 0.32), toneMapped: false }),
      soffit: new THREE.MeshStandardMaterial({ map: tex.plaster, color: '#8d8b86', roughness: 0.9 }),
      leather: new THREE.MeshStandardMaterial({ color: '#b8672c', roughness: 0.45 }),
      shelfGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2, 0.9), toneMapped: false }),
      veneer: new THREE.MeshStandardMaterial({ color: '#b27a45', emissive: '#6a3a12', emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.6 }),
      drumGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.3, 0.6), toneMapped: false }),
      amber: new THREE.MeshStandardMaterial({ color: '#d99a3a', emissive: '#a05a10', emissiveIntensity: 1.3, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false }),
      greenGlass: new THREE.MeshStandardMaterial({ color: '#7ab86a', emissive: '#2f7a2a', emissiveIntensity: 1.1, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
      curtain: new THREE.MeshStandardMaterial({ color: '#c08a58', roughness: 0.9, side: THREE.DoubleSide }),
      night: new THREE.MeshBasicMaterial({ color: '#0f1a24' }),
    }),
    [tex],
  )

  // ── мягкая мебель, столы, кресла ──
  const furniture = useMemo(() => {
    const out = {
      sofas: [] as THREE.Matrix4[],
      sofaColors: [] as THREE.Color[],
      longSofas: [] as THREE.Matrix4[],
      pillows: [] as THREE.Matrix4[],
      pillowColors: [] as THREE.Color[],
      tops: [] as THREE.Matrix4[],
      tableLegs: [] as THREE.Matrix4[],
      chairs: [] as THREE.Matrix4[],
      chairColors: [] as THREE.Color[],
      chairLegs: [] as THREE.Matrix4[],
    }
    const beige = new THREE.Color('#b3a292')
    const taupe = new THREE.Color('#9b8f86')
    const pillowPalette = ['#d69aa2', '#e8dccb', '#3f7d78', '#c9785a'].map((c) => new THREE.Color(c))
    const chairPalette = ['#1f5f5a', '#d9b1a8', '#1f5f5a', '#b8ab9c'].map((c) => new THREE.Color(c))
    let k = 0
    const chair = (x: number, z: number, theta: number) => {
      out.chairs.push(mat([x, 0, z], [1, 1, 1], theta))
      out.chairLegs.push(mat([x, 0, z], [1, 1, 1], theta))
      out.chairColors.push(chairPalette[k++ % chairPalette.length])
    }
    const pillows = (x: number, z: number, theta: number, offsets: number[]) =>
      offsets.forEach((lx, i) => {
        out.pillows.push(mat(place(x, z, theta, lx, 0.66, -0.12), [0.42, 0.38, 0.12], theta + (i % 2 ? 0.12 : -0.1), -0.25))
        out.pillowColors.push(pillowPalette[(k + i) % pillowPalette.length])
      })
    const table = (x: number, z: number, theta: number) => {
      out.tops.push(mat([x, 0.75, z], [1.2, 0.05, 0.8], theta))
      out.tableLegs.push(mat([x, 0, z], [1, 1, 1], theta))
    }

    // диваны под окнами: спинкой к стене, стол и два кресла напротив
    for (const [x, z] of [
      [H.x0 + 0.5, -89],
      [H.x0 + 0.5, -94],
      [H.x1 - 0.5, -89],
      [H.x1 - 0.5, -93.5],
    ]) {
      const left = x < 0
      const theta = left ? Math.PI / 2 : -Math.PI / 2
      out.sofas.push(mat([x, 0, z], [1, 1, 1], theta))
      out.sofaColors.push(left ? beige : taupe)
      pillows(x, z, theta, [-0.7, 0.65])
      const tx = x + (left ? 1.25 : -1.25)
      table(tx, z, theta)
      chair(tx + (left ? 0.95 : -0.95), z - 0.36, left ? -Math.PI / 2 : Math.PI / 2)
      chair(tx + (left ? 0.95 : -0.95), z + 0.36, left ? -Math.PI / 2 : Math.PI / 2)
    }
    // длинный серый диван под буквами на мху — как на фото стены
    const bx = 0
    const bz = H.zBack + 0.55
    out.longSofas.push(mat([bx, 0, bz], [1, 1, 1], 0))
    pillows(bx, bz, 0, [-1.4, -0.3, 1.2])
    table(bx - 0.9, bz + 1.2, 0)
    table(bx + 0.9, bz + 1.2, 0)
    chair(bx - 0.9, bz + 2.15, Math.PI)
    chair(bx + 0.9, bz + 2.15, Math.PI)
    // кресла у общего стола — с дальней стороны, лицом к камере на блюдах
    for (const x of [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5]) chair(x, TABLE_Z - 0.85, 0)
    // столы на четверых между входом и общим столом. Ниже пролётов камеры
    // 3 → 4 и 6 → 7 (там камера на высоте ≈ 1.8 м) и позади кадров с блюдами
    for (const x of [-4.6, -1.6, 1.4]) {
      table(x, -89, 0)
      chair(x, -89.75, 0)
      chair(x, -88.25, Math.PI)
    }
    return out
  }, [H.x0, H.x1, H.zBack])

  // ── стеллажи до потолка: бутылки, книги, зелень, плющ ──
  const shelving = useMemo(() => {
    const r = seeded(19)
    const out = {
      frames: [] as THREE.Matrix4[],
      boards: [] as THREE.Matrix4[],
      bottles: [] as THREE.Matrix4[],
      bottleColors: [] as THREE.Color[],
      books: [] as THREE.Matrix4[],
      bookColors: [] as THREE.Color[],
      leaves: [] as THREE.Matrix4[],
      leafColors: [] as THREE.Color[],
    }
    const green = ['#1f7a3c', '#2a8a47', '#175c2e'].map((c) => new THREE.Color(c))
    const bar = ['#b86a2a', '#d9cfb8', '#6b2a1a', '#1f7a3c', '#c9a032'].map((c) => new THREE.Color(c))
    const bookPalette = ['#7a2e22', '#2f4a5e', '#c9a46a', '#3b5a3a', '#e3dccd', '#1d1d1f'].map((c) => new THREE.Color(c))
    const leafPalette = ['#2c5a28', '#3b6b32', '#234822', '#46743a'].map((c) => new THREE.Color(c))
    const leaf = (x: number, y: number, z: number, s: number) => {
      out.leaves.push(mat([x, y, z], [s, s, s], r() * 3, r() * 3))
      out.leafColors.push(leafPalette[Math.floor(r() * leafPalette.length)])
    }
    const unit = (cx: number, cz: number, w: number, d: number, alongZ: boolean, levels: number[], barShelf = false) => {
      const px = alongZ ? d / 2 : w / 2
      const pz = alongZ ? w / 2 : d / 2
      const top = levels[levels.length - 1] + 0.1
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.frames.push(mat([cx + sx * px, top / 2, cz + sz * pz], [0.04, top, 0.04]))
      levels.forEach((y, li) => {
        out.boards.push(mat([cx, y, cz], alongZ ? [d, 0.03, w] : [w, 0.03, d]))
        let t = -w / 2 + 0.08
        while (t < w / 2 - 0.1) {
          const along = (v: number) => (alongZ ? [cx + (r() - 0.5) * d * 0.3, cz + v] : [cx + v, cz + (r() - 0.5) * d * 0.3])
          // на фото стеллажи — это зелень и зелёные бутылки, книг немного
          const roll = r()
          const kind = barShelf ? 0 : roll < 0.42 ? 0 : roll < 0.62 ? 2 : 3
          if (kind === 0) {
            // ряд бутылок
            const n = 2 + Math.floor(r() * 4)
            for (let i = 0; i < n && t < w / 2 - 0.1; i++, t += 0.1) {
              const [x, z] = along(t)
              const h = 0.24 + r() * 0.14
              out.bottles.push(mat([x, y + h / 2 + 0.02, z], [0.035, h, 0.035]))
              out.bottleColors.push(barShelf ? bar[Math.floor(r() * bar.length)] : green[Math.floor(r() * green.length)])
            }
          } else if (kind === 2) {
            // стопка книг корешками наружу
            const n = 3 + Math.floor(r() * 5)
            for (let i = 0; i < n && t < w / 2 - 0.1; i++, t += 0.045) {
              const [x, z] = along(t)
              const h = 0.2 + r() * 0.1
              out.books.push(mat([x, y + h / 2 + 0.02, z], alongZ ? [0.18, h, 0.04] : [0.04, h, 0.18]))
              out.bookColors.push(bookPalette[Math.floor(r() * bookPalette.length)])
            }
          } else {
            // горшок с зеленью и плети плюща
            const [x, z] = along(t)
            leaf(x, y + 0.16, z, 0.16 + r() * 0.08)
            if (li > 0) for (let s = 0; s < 4; s++) leaf(x + (r() - 0.5) * 0.12, y - 0.1 - s * 0.14, z + (r() - 0.5) * 0.12, 0.06)
            t += 0.3
          }
          t += 0.06
        }
      })
    }
    // перегородки по сторонам от DJ — до опущенного края потолка
    unit(-4.6, -97.8, 2.4, 0.36, false, [0.12, 0.68, 1.24, 1.8, 2.36, 2.92, 3.4])
    unit(4.6, -97.8, 2.4, 0.36, false, [0.12, 0.68, 1.24, 1.8, 2.36, 2.92, 3.4])
    // за барной стойкой
    unit(H.x1 - 0.25, -98.4, 5.2, 0.3, true, [1.45, 1.95, 2.45, 2.95], true)
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

  // Буквы на мху: LOFT, лист, PARK — по центру над DJ-пультом
  const EMB_W = 0.44
  const GAP = 0.2
  const signW = loftWord.width + GAP + EMB_W + GAP + parkWord.width
  const signX = -signW / 2
  const SIGN_Y = 2.2
  const SOFFIT_Y = H.h - 0.3

  // Окна по боковым стенам — над диванами; между ними кирпичные колонны
  const windows: [number, number][] = [
    [H.x0, -89],
    [H.x0, -94],
    [H.x1, -89],
    [H.x1, -93.5],
  ]
  const pillars: [number, number][] = [
    [H.x0, -91.5],
    [H.x0, -96.6],
    [H.x1, -91.25],
    [H.x1, -95.35],
  ]

  // Светильники висят в ≥ 1 м от пролётов камеры 6 → 7 и 7 → 8 (keyframes.ts)
  const drums: [number, number][] = [
    [0, -87.2],
    [H.x1 - 1.75, -89],
    [H.x1 - 1.75, -93.5],
  ]
  const globes: [number, number, number, boolean][] = [
    [-1.8, 2.72, TABLE_Z, true],
    [1.8, 2.72, TABLE_Z, false],
    [H.x0 + 1.55, 2.6, -88.6, true],
    [H.x0 + 1.95, 2.85, -89.3, false],
    [H.x0 + 1.55, 2.6, -93.6, false],
    [H.x0 + 1.95, 2.85, -94.3, true],
    [-8.8, 2.7, -100.4, true],
    [-10.2, 2.9, -100.1, false],
  ]

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, cz]}>
        <planeGeometry args={[width, depth]} />
        {/* серо-коричневая плитка под дерево, как на фото зала */}
        <meshStandardMaterial map={tex.floor} color="#8f857b" roughness={0.55} />
      </mesh>

      {/* потолок: тёмно-зелёный короб, серый опущенный край, LED-лента и засветка */}
      <mesh rotation-x={Math.PI / 2} position={[0, H.h, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1d2a22" roughness={0.9} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H.h - 0.01, cz]}>
        <planeGeometry args={[width - COVE * 2, depth - COVE * 2]} />
        <meshBasicMaterial map={tex.cove} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
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
        <mesh key={`${x}${z}`} position={[x, SOFFIT_Y + 0.15, z]} material={mats.soffit}>
          <boxGeometry args={[w, 0.3, d]} />
        </mesh>
      ))}
      {[
        [0, H.zFront - COVE - 0.02, width - COVE * 2, 0.04],
        [0, H.zBack + COVE + 0.02, width - COVE * 2, 0.04],
        [H.x0 + COVE + 0.02, cz, 0.04, depth - COVE * 2],
        [H.x1 - COVE - 0.02, cz, 0.04, depth - COVE * 2],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}${z}`} position={[x, SOFFIT_Y + 0.33, z]} material={mats.cove}>
          <boxGeometry args={[w, 0.03, d]} />
        </mesh>
      ))}

      {/* боковые стены: деревянная обшивка, окна со шторами, кирпичные колонны */}
      {[H.x0, H.x1].map((x) => (
        <mesh key={x} position={[x, H.h / 2, cz]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2}>
          <planeGeometry args={[depth, H.h]} />
          <meshStandardMaterial map={tex.wall} color="#9a7556" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {windows.map(([wx, wz]) => {
        const inward = wx < 0 ? 1 : -1
        const ry = wx < 0 ? Math.PI / 2 : -Math.PI / 2
        return (
          <group key={`${wx}${wz}`}>
            <mesh position={[wx + inward * 0.03, 2.1, wz]} rotation-y={ry} material={mats.night}>
              <planeGeometry args={[1.9, 2.3]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[wx + inward * 0.05, 2.1, wz + s * 0.97]} material={steel}>
                <boxGeometry args={[0.06, 2.4, 0.06]} />
              </mesh>
            ))}
            <mesh position={[wx + inward * 0.05, 1.08, wz]} material={steel}>
              <boxGeometry args={[0.06, 0.06, 2]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geos.window} material={mats.curtain} position={[wx + inward * 0.14, SOFFIT_Y - 1.55, wz + s * 1.2]} rotation-y={ry} />
            ))}
          </group>
        )
      })}
      {pillars.map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px + (px < 0 ? 0.15 : -0.15), H.h / 2, pz]}>
          <boxGeometry args={[0.3, H.h, 0.5]} />
          <meshStandardMaterial map={tex.brick} roughness={0.9} />
        </mesh>
      ))}

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
        <mesh key={x} geometry={geos.frontCurtain} position={[x, H.h / 2, H.zFront - 0.25]}>
          <meshStandardMaterial color="#a3161f" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* резная ширма справа от входа */}
      <group position={[7.4, 0, -88.7]} rotation-y={Math.PI / 2}>
        <mesh position={[0, 1.25, 0]}>
          <planeGeometry args={[2.4, 2.3]} />
          <meshStandardMaterial map={tex.screen} alphaTest={0.4} side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
        {[-1.22, 1.22].map((s) => (
          <mesh key={s} position={[s, 1.25, 0]} material={mats.darkWood}>
            <boxGeometry args={[0.06, 2.5, 0.08]} />
          </mesh>
        ))}
      </group>

      {/* задняя стена: грубые доски внизу, мох во всю ширину */}
      <mesh position={[0, 0.6, H.zBack + 0.03]}>
        <planeGeometry args={[width, 1.2]} />
        <meshStandardMaterial map={tex.wainscot} color="#8c6e56" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.22, H.zBack + 0.07]} material={mats.darkWood}>
        <boxGeometry args={[width, 0.05, 0.08]} />
      </mesh>
      <mesh position={[0, 1.2 + (SOFFIT_Y - 1.2) / 2, H.zBack + 0.05]}>
        <planeGeometry args={[width, SOFFIT_Y - 1.2]} />
        <meshStandardMaterial map={tex.moss} roughness={1} />
      </mesh>
      <mesh geometry={loftWord.geo} material={mats.silver} position={[signX, SIGN_Y, H.zBack + 0.06]} />
      <mesh geometry={parkWord.geo} material={mats.silver} position={[signX + loftWord.width + GAP * 2 + EMB_W, SIGN_Y, H.zBack + 0.06]} />
      <group position={[signX + loftWord.width + GAP + EMB_W / 2, SIGN_Y + 0.31, H.zBack + 0.06]}>
        <mesh geometry={emblem.rings} material={mats.silver} />
        <mesh geometry={emblem.vein} material={mats.silver} />
      </group>
      {/* трек со спотами и люстра-клетка над буквами */}
      <mesh position={[0, SOFFIT_Y - 0.06, H.zBack + COVE + 0.1]} material={steel}>
        <boxGeometry args={[8, 0.05, 0.05]} />
      </mesh>
      {[-3.6, -2.2, 2.2, 3.6].map((x) => (
        <mesh key={x} position={[x, SOFFIT_Y - 0.2, H.zBack + COVE]} rotation-x={0.7} material={steel}>
          <cylinderGeometry args={[0.06, 0.05, 0.22, 10]} />
        </mesh>
      ))}
      {/* Тёплые пятна от спотов на мху, как на фото стены: без них стена
          была ровно-тёмной, а буквы — плоскими. Аддитивные плоскости вместо
          четырёх spotLight: каждый источник света дорожает для всех материалов */}
      {[-3.6, -2.2, 2.2, 3.6].map((x) => (
        <mesh key={`pool${x}`} position={[x * 0.92, SOFFIT_Y - 1.15, H.zBack + 0.075]}>
          <planeGeometry args={[2.1, 2.7]} />
          <meshBasicMaterial map={tex.spot} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <group position={[-2.4, 2.95, H.zBack + 0.75]}>
        <mesh position={[0, 0.4, 0]} material={mats.wire}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 3]} />
        </mesh>
        {[0.16, -0.16].map((y) => (
          <mesh key={y} position-y={y} rotation-x={Math.PI / 2} material={steel}>
            <torusGeometry args={[0.36, 0.018, 6, 28]} />
          </mesh>
        ))}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36]} material={steel}>
              <boxGeometry args={[0.015, 0.34, 0.015]} />
            </mesh>
          )
        })}
        {[-0.15, 0, 0.15].map((x, i) => (
          <mesh key={x} position={[x, -0.02 - (i % 2) * 0.05, (i - 1) * 0.08]} scale={[0.045, 0.075, 0.045]} geometry={geos.ball} material={mats.bulb} />
        ))}
      </group>

      {/* Общий стол для трёх блюд: три стола «ёлочкой», сдвинутых в ряд для
          большой компании, обычной обеденной высоты. Прежний стол-«подиум»
          высотой в метр на глухих чёрных опорах рядом с креслами выглядел
          барной стойкой. Блюдо на каждом столе по центру (x = −3.6, 0, 3.6) */}
      {[-3.6, 0, 3.6].map((x) => (
        <group key={x} position={[x, 0, TABLE_Z]}>
          <mesh position={[0, 0.74, 0]}>
            {/* глубина 1.4: доска с хачапури не свисает с края */}
            <boxGeometry args={[3.6, 0.06, 1.4]} />
            <meshStandardMaterial map={tex.longHerring} roughness={0.5} />
          </mesh>
          <mesh geometry={geos.sectionLegs} material={steel} />
        </group>
      ))}

      <Instances items={furniture.sofas} geometry={geos.sofa} material={mats.fabric} colors={furniture.sofaColors} />
      <Instances items={furniture.longSofas} geometry={geos.longSofa} material={mats.fabric} colors={[new THREE.Color('#8c8782')]} />
      <Instances items={furniture.pillows} geometry={geos.box} material={mats.fabric} colors={furniture.pillowColors} />
      <Instances items={furniture.tops} geometry={geos.box} material={mats.tableTop} />
      <Instances items={furniture.tableLegs} geometry={geos.tableLegs} material={steel} />
      <Instances items={furniture.chairs} geometry={geos.armchair} material={mats.velvet} colors={furniture.chairColors} />
      <Instances items={furniture.chairLegs} geometry={geos.legs} material={steel} />

      {/* деревянные «барабаны» из реек */}
      {/* Сплошной барабан из шпона, свет — только снизу и тёплым отсветом
          сквозь тонкое дерево. Прежние рейки с просветами давали две белые
          светящиеся щели вместо абажура */}
      {drums.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 2.85, z]}>
          <mesh position={[0, 0.45, 0]} material={mats.wire}>
            <cylinderGeometry args={[0.008, 0.008, 0.6, 3]} />
          </mesh>
          <mesh material={mats.veneer}>
            <cylinderGeometry args={[0.6, 0.6, 0.3, 40, 1, true]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation-x={-Math.PI / 2} material={mats.darkWood}>
            <circleGeometry args={[0.6, 40]} />
          </mesh>
          <mesh position={[0, -0.13, 0]} rotation-x={Math.PI / 2} material={mats.drumGlow}>
            <circleGeometry args={[0.56, 40]} />
          </mesh>
        </group>
      ))}
      {/* стеклянные шары: янтарные и зелёные, на разной высоте */}
      {globes.map(([x, y, z, isAmber]) => (
        <group key={`${x}${z}`} position={[x, y, z]}>
          <mesh position={[0, (SOFFIT_Y - y) / 2, 0]} material={mats.wire}>
            <cylinderGeometry args={[0.007, 0.007, SOFFIT_Y - y, 3]} />
          </mesh>
          <mesh scale={0.22} geometry={geos.ball} material={isAmber ? mats.amber : mats.greenGlass} />
          <mesh scale={[0.04, 0.07, 0.04]} geometry={geos.ball} material={mats.bulb} />
        </group>
      ))}
      {/* люстра из янтарных «лепестков» у бара */}
      <group position={[8.3, 2.75, -97.6]}>
        <mesh position={[0, 0.45, 0]} material={mats.wire}>
          <cylinderGeometry args={[0.008, 0.008, 0.5, 3]} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2
          const tier = i % 2
          return <mesh key={i} position={[Math.cos(a) * (0.3 + tier * 0.08), -tier * 0.14, Math.sin(a) * (0.3 + tier * 0.08)]} rotation={[0, -a, 0.9]} scale={[0.02, 0.2, 0.14]} geometry={geos.ball} material={mats.amber} />
        })}
        <mesh scale={[0.06, 0.08, 0.06]} geometry={geos.ball} material={mats.bulb} />
      </group>

      {/* стеллажи */}
      <Instances items={shelving.frames} geometry={geos.box} material={steel} />
      <Instances items={shelving.boards} geometry={geos.box} material={steel} />
      <Instances items={shelving.bottles} geometry={geos.cyl} material={mats.bottle} colors={shelving.bottleColors} />
      <Instances items={shelving.books} geometry={geos.box} material={mats.plain} colors={shelving.bookColors} />
      <Instances items={shelving.leaves} geometry={geos.leaf} material={mats.leaf} colors={shelving.leafColors} />

      {/* бар: кирпичный фасад, столешница, подсветка, рыжие кожаные стулья */}
      <group position={[H.x1 - 1.8, 0, -98.4]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.8, 1.1, 5.6]} />
          <meshStandardMaterial color="#2a1a13" roughness={0.9} />
        </mesh>
        <mesh position={[-0.41, 0.55, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[5.6, 1.1]} />
          <meshStandardMaterial map={tex.brick} color="#c9b8a8" roughness={0.9} />
        </mesh>
        <mesh position={[-0.05, 1.13, 0]} material={mats.darkWood}>
          <boxGeometry args={[1.05, 0.06, 5.8]} />
        </mesh>
        <mesh position={[-0.43, 1.06, 0]} material={mats.shelfGlow}>
          <boxGeometry args={[0.02, 0.02, 5.6]} />
        </mesh>
        {[-2, -0.7, 0.6, 1.9].map((z) => (
          <group key={z} position={[-1, 0, z]}>
            <mesh position={[0, 0.38, 0]} material={steel}>
              <cylinderGeometry args={[0.025, 0.04, 0.76, 6]} />
            </mesh>
            <mesh position={[0, 0.8, 0]} material={mats.leather}>
              <boxGeometry args={[0.42, 0.08, 0.42]} />
            </mesh>
            <mesh position={[-0.2, 1.08, 0]} rotation-z={0.15} material={mats.leather}>
              <boxGeometry args={[0.06, 0.5, 0.4]} />
            </mesh>
          </group>
        ))}
      </group>
      {[1.44, 1.94, 2.44, 2.94].map((y) => (
        <mesh key={y} position={[H.x1 - 0.12, y - 0.03, -98.4]} material={mats.shelfGlow}>
          <boxGeometry args={[0.02, 0.02, 5.2]} />
        </mesh>
      ))}

      {/* высокие кашпо с зеленью у входа и в углу */}
      {[
        [H.x0 + 0.8, H.zFront - 0.9],
        [H.x1 - 0.8, H.zFront - 0.9],
        [-11, H.zBack + 0.7],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.7, 0.9, 0.7]} />
            <meshStandardMaterial color="#26282a" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh
              key={k}
              geometry={geos.plantCrown}
              material={mats.foliage}
              position={[Math.cos(k * 1.7) * 0.22, 1.15 + k * 0.28, Math.sin(k * 1.7) * 0.22]}
              rotation-y={k * 1.3}
              scale={[0.46, 0.42, 0.46]}
            />
          ))}
        </group>
      ))}

      <pointLight position={[0, 2.9, TABLE_Z + 0.5]} color="#ffb870" intensity={16} distance={10} decay={1.4} />
      <pointLight position={[-7.5, 2.7, -95]} color="#ffa552" intensity={12} distance={12} decay={1.4} />
      <pointLight position={[8.4, 2.6, -95]} color="#ffa552" intensity={12} distance={12} decay={1.4} />

      {/* DJ-пульт — в углу у стены из мха: центр под буквами занят диваном */}
      <group position={[-6.4, 0, 0]}>
        <DJBooth />
      </group>

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
