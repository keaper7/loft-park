'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { POLES, SQUARE, TERRACE, TREES } from './layout'
import { concreteTexture, herringboneTexture, paversTexture, planksTexture, shadowTexture, slatsTexture, weaveTexture } from './textures'
import { Instances, mat, seeded } from './instancing'
import { crownGeometry, foliageMaterial, puffGeometry } from './foliage'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Площадь и терраса Loft Park — по фотографиям гостей:
 * - площадь из разноцветной плитки, лавочки у заборчика, столбы, от которых
 *   к террасе натянуты параллельные нити гирлянд;
 * - фасад: чёрная стальная рама, в ней деревянные ящики со стриженым
 *   кустарником; вход — ступень настила, зелёный коврик и два бетонных куба
 *   с деревцами;
 * - над настилом бежевые маркизы складками на чёрном каркасе, в них проёмы
 *   под стволы деревьев;
 * - плетёные кресла-«бочонки» с цветными подушками у деревянных столов,
 *   пирамиды-обогреватели, белые фонари-домики, плетёные подвесные лампы;
 * - лаунж справа: диваны на деревянном каркасе, красные кресла, красные
 *   шторы, реечная перегородка и «облако» из искусственных цветов под крышей.
 */

const steel = new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.5, roughness: 0.55 })

type Span = [number, number, number, number, number, number]

/** Провисающие гирлянды: пары точек → кривые → лампы одним инстансом */
function Festoons({ spans, density }: { spans: Span[]; density: number }) {
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const curves = useMemo(
    () =>
      spans.map(([ax, ay, az, bx, by, bz]) => {
        const A = new THREE.Vector3(ax, ay, az)
        const B = new THREE.Vector3(bx, by, bz)
        const sag = A.distanceTo(B) * 0.055
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
  const points = useMemo(
    () =>
      curves.flatMap((c) => {
        const n = Math.max(4, Math.round(c.getLength() * density))
        return Array.from({ length: n }, (_, i) => c.getPoint((i + 0.5) / n))
      }),
    [curves, density],
  )
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    points.forEach((p, i) => bulbs.current?.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.08, p.z)))
    if (bulbs.current) bulbs.current.instanceMatrix.needsUpdate = true
  }, [points])
  return (
    <group>
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 32, 0.012, 3, false]} />
          <meshBasicMaterial color="#0d0d0d" />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]}>
        {/* Лампочка тусклее и мельче: при прежней яркости bloom раздувал
            каждую в шар размером с голову, особенно под маркизами у камеры */}
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshBasicMaterial color={[3.6, 2.35, 1.05]} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/**
 * Маркиза складками, как у выдвижных тентов на фото. Складка — плавная
 * волна, а не зигзаг: острые зубья по торцам полотен читались пилой.
 */
function pleatGeometry(w: number, d: number, pleat = 0.3, amp = 0.045) {
  const waves = Math.max(4, Math.round(w / pleat))
  const seg = waves * 6
  const g = new THREE.PlaneGeometry(w, d, seg, 1)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + w / 2) / w
    p.setY(i, amp * (0.5 - 0.5 * Math.cos(u * waves * Math.PI * 2)))
  }
  g.computeVertexNormals()
  return g
}

/**
 * Плетёное кресло-«таб», как на фото террасы: полукруглая спинка плавно
 * опускается в подлокотники, по верху — толстый валик, под сиденьем плетёная
 * база на четырёх ножках. Прежние «бочонки» без подлокотников и ножек
 * выглядели как корзины для бумаг. Спинка — у локального +z, пол — y = 0.
 */
function rattanChairGeometries() {
  const SEAT = 0.4
  const ARC = Math.PI * 0.72
  const R_TOP = 0.37
  const R_BOT = 0.3
  const profile = (theta: number) => {
    const k = THREE.MathUtils.smoothstep(Math.min(1, Math.abs(theta) / ARC), 0.3, 1)
    return 0.2 + 0.38 * (1 - k)
  }
  const shell = new THREE.CylinderGeometry(R_TOP, R_BOT, 1, 32, 4, true, -ARC, ARC * 2)
  const p = shell.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, SEAT + (p.getY(i) + 0.5) * profile(Math.atan2(p.getX(i), p.getZ(i))))
  shell.computeVertexNormals()
  const base = new THREE.CylinderGeometry(0.3, 0.25, 0.22, 24, 1, true)
  base.translate(0, SEAT - 0.11, 0)

  const rimPts = Array.from({ length: 25 }, (_, i) => {
    const th = -ARC + (i / 24) * ARC * 2
    return new THREE.Vector3(Math.sin(th) * R_TOP, SEAT + profile(th), Math.cos(th) * R_TOP)
  })
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 40, 0.03, 6, false)
  const ring = new THREE.TorusGeometry(0.3, 0.022, 6, 24)
  ring.rotateX(Math.PI / 2)
  ring.translate(0, SEAT, 0)
  const legs = [1, 3, 5, 7].map((k) => {
    const a = (k * Math.PI) / 4
    const g = new THREE.CylinderGeometry(0.02, 0.015, SEAT - 0.2, 5)
    g.translate(Math.sin(a) * 0.2, (SEAT - 0.2) / 2, Math.cos(a) * 0.2)
    return g
  })
  const cushion = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 18)
  cushion.translate(0, SEAT + 0.05, 0)
  return {
    woven: mergeGeometries([shell, base])!,
    frame: mergeGeometries([rim, ring, ...legs])!,
    cushion,
  }
}

/** Стриженый кустарник: коробка с неровной поверхностью */
function hedgeGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 10, 3, 3)
  const p = g.attributes.position
  const r = seeded(3)
  // Одна и та же точка на разных гранях сдвигается одинаково — без щелей
  const cache = new Map<string, number>()
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)}|${p.getY(i).toFixed(3)}|${p.getZ(i).toFixed(3)}`
    let n = cache.get(key)
    if (n === undefined) {
      n = (r() - 0.5) * 0.09
      cache.set(key, n)
    }
    p.setXYZ(i, p.getX(i) * (1 + n), p.getY(i) * (1 + n * 0.7), p.getZ(i) * (1 + n))
  }
  g.computeVertexNormals()
  return g
}

/**
 * Диван-скамья веранды: деревянная рама с подлокотниками и мягкие подушки.
 * Спинка — у локального −z. На фото такие скамьи стоят вдоль всего настила
 * спинками к ящикам с зеленью, столы «ёлочкой» — перед ними.
 */
function benchGeometries(w: number) {
  return {
    frame: mergeGeometries([
      new RoundedBoxGeometry(w, 0.32, 0.9, 2, 0.04).translate(0, 0.16, 0),
      new RoundedBoxGeometry(0.13, 0.6, 0.9, 2, 0.04).translate(-w / 2 + 0.065, 0.3, 0),
      new RoundedBoxGeometry(0.13, 0.6, 0.9, 2, 0.04).translate(w / 2 - 0.065, 0.3, 0),
    ])!,
    cushion: mergeGeometries([
      new RoundedBoxGeometry(w - 0.22, 0.22, 0.8, 3, 0.08).translate(0, 0.43, 0.04),
      new RoundedBoxGeometry(w - 0.22, 0.52, 0.22, 3, 0.08).translate(0, 0.72, -0.31),
    ])!,
  }
}

/** Штора со складками */
function curtainGeometry(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 24, 1)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 10) * 0.05)
  g.computeVertexNormals()
  return g
}

const MODULE = 2

/**
 * Ящики с зеленью вдоль прохода. Проход между ними и есть дорога в зал:
 * узкий, как на фото, — гость идёт коридором из зелени, а не по пустому
 * настилу. Левый ящик отодвинут дальше правого: мимо него проходит камера
 * на отрезке 3 → 4 (keyframes.ts), ей нужен запас в метр.
 */
const RAIL_X = [-4.2, 2.4]

export function Pavilion({ quality }: { quality: 'high' | 'low' }) {
  const T = TERRACE
  const midZ = (T.zFront + T.zBack) / 2
  const DECK_Y = 0.2
  const tex = useMemo(
    () => ({
      // брусок ≈ 0.2 × 0.1 м, как настоящая плитка площади
      pavers: paversTexture([22, 9]),
      deck: planksTexture([6, 4], false),
      slats: slatsTexture([2, 1]),
      screen: slatsTexture([3, 2], true),
      concrete: concreteTexture(),
      weave: weaveTexture([7, 2]),
      // столы веранды — такие же «ёлочкой», как в зале
      herring: herringboneTexture(),
      ceiling: planksTexture([4, 3], true),
      shadow: shadowTexture(),
    }),
    [],
  )

  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      hedge: hedgeGeometry(),
      pleat: pleatGeometry(2.34, 2.74),
      // дощатый потолок в глубине веранды: полотно тента переходит в крышу
      panel: new THREE.PlaneGeometry(2.4, 2.8).rotateX(Math.PI / 2),
      chair: rattanChairGeometries(),
      leg: new THREE.CylinderGeometry(0.035, 0.035, 1, 6),
      bloom: puffGeometry(),
      smallCrown: crownGeometry(31, 4, 1),
      curtain: curtainGeometry(1.3, T.roofY - 0.1),
      bench: benchGeometries(2.2),
      pillow: new RoundedBoxGeometry(0.44, 0.4, 0.15, 3, 0.06),
      top: new RoundedBoxGeometry(1.4, 0.06, 0.9, 3, 0.02),
      shadow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      // подвесные кашпо: горшок на шнуре и свисающие плети
      pot: new THREE.CylinderGeometry(0.21, 0.15, 0.2, 12),
      cord: new THREE.CylinderGeometry(0.008, 0.008, 1, 3),
      // сервировка: стакан тонкой стенкой и свеча
      glass: mergeGeometries([
        new THREE.CylinderGeometry(0.036, 0.03, 0.12, 14, 1, true).translate(0, 0.06, 0),
        new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).translate(0, 0.006, 0),
      ])!,
      candle: new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10).translate(0, 0.05, 0),
      flame: new THREE.SphereGeometry(0.016, 8, 6).translate(0, 0.115, 0),
    }),
    [T.roofY],
  )
  const mats = useMemo(
    () => ({
      // Снизу ткань светлая и тёплая от ламп; сверху — отдельная тёмная
      // сторона: с высоты светлые полотна под небесным светом читались
      // сеткой солнечных панелей
      awning: new THREE.MeshStandardMaterial({ color: '#d8cdb6', roughness: 0.9, side: THREE.BackSide }),
      awningTop: new THREE.MeshStandardMaterial({ color: '#5e5446', roughness: 1 }),
      rib: new THREE.MeshStandardMaterial({ color: '#19191b', roughness: 0.95 }),
      planter: new THREE.MeshStandardMaterial({ map: tex.slats, roughness: 0.8 }),
      hedge: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.95 }),
      screen: new THREE.MeshStandardMaterial({ map: tex.screen, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }),
      tableWood: new THREE.MeshStandardMaterial({ color: '#c08a52', roughness: 0.55 }),
      rattan: new THREE.MeshStandardMaterial({ map: tex.weave, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }),
      rattanSolid: new THREE.MeshStandardMaterial({ color: '#9c7446', roughness: 0.9 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
      bloom: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
      leafGreen: foliageMaterial({ color: '#5a8f48' }),
      // Белая листва под цвет инстанса: цвет инстанса умножается на цвет
      // материала, и зелёный по зелёному давал почти чёрные кусты
      leafTint: foliageMaterial({ color: '#ffffff' }),
      leafRed: foliageMaterial({ color: '#8a4432' }),
      red: new THREE.MeshStandardMaterial({ color: '#a4151f', roughness: 0.85, side: THREE.DoubleSide }),
      redSeat: new THREE.MeshStandardMaterial({ color: '#b5202a', roughness: 0.7 }),
      sofa: new THREE.MeshStandardMaterial({ color: '#8d8b86', roughness: 0.95 }),
      frameWood: new THREE.MeshStandardMaterial({ color: '#9a6436', roughness: 0.6 }),
      orange: new THREE.MeshStandardMaterial({ color: '#e0803f', roughness: 0.9 }),
      ceiling: new THREE.MeshStandardMaterial({ map: tex.ceiling, color: '#b08a5e', roughness: 0.85, side: THREE.DoubleSide }),
      herring: new THREE.MeshStandardMaterial({ map: tex.herring, roughness: 0.5 }),
      benchWood: new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 0.75 }),
      benchSeat: new THREE.MeshStandardMaterial({ color: '#8f8b83', roughness: 0.95 }),
      pot: new THREE.MeshStandardMaterial({ color: '#2b2722', roughness: 0.85 }),
      soil: new THREE.MeshStandardMaterial({ color: '#241a12', roughness: 1 }),
      glass: new THREE.MeshStandardMaterial({ color: '#dfe8ea', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
      wax: new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.3), toneMapped: false }),
      contact: new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false }),
    }),
    [tex],
  )

  /**
   * Потолок веранды: у фасада — тентовые полотна складками, в глубине
   * тёплый дощатый потолок. На фото так и есть: выдвижной навес над
   * первым рядом переходит в деревянную крышу над проходом и залом.
   * Панелей нет там, где сквозь крышу растут деревья.
   */
  const roof = useMemo(() => {
    const pleat: THREE.Matrix4[] = []
    const wood: THREE.Matrix4[] = []
    for (let x = T.x0 + 1.2; x < T.x1; x += 2.4) {
      for (let z = T.zFront - 1.4; z > T.zBack; z -= 2.8) {
        if (TREES.some((t) => t.planter && Math.abs(t.x - x) < 1.9 && Math.abs(t.z - z) < 2)) continue
        ;(z > -78 ? pleat : wood).push(mat([x, T.roofY, z]))
      }
    }
    return { pleat, wood }
  }, [T])

  // ── фасад и правый бок: рама из стоек, ящики с кустарником ──
  const fence = useMemo(() => {
    const r = seeded(11)
    const boxes: THREE.Matrix4[] = []
    const hedges: THREE.Matrix4[] = []
    const hedgeColors: THREE.Color[] = []
    const posts: THREE.Matrix4[] = []
    const rails: THREE.Matrix4[] = []
    const addRun = (from: number, to: number, fixed: number, alongX: boolean) => {
      const n = Math.round(Math.abs(to - from) / MODULE)
      const dir = Math.sign(to - from)
      for (let i = 0; i < n; i++) {
        const c = from + dir * (i + 0.5) * MODULE
        const [x, z] = alongX ? [c, fixed] : [fixed, c]
        const ry = alongX ? 0 : Math.PI / 2
        boxes.push(mat([x, 0.28, z], [MODULE - 0.14, 0.56, 0.5], ry))
        hedges.push(mat([x, 0.78, z], [MODULE - 0.24, 0.46, 0.44], ry))
        hedgeColors.push(new THREE.Color().setHSL(0.27 + r() * 0.04, 0.45, 0.2 + r() * 0.05))
      }
      for (let i = 0; i <= n; i++) {
        const c = from + dir * i * MODULE
        const [x, z] = alongX ? [c, fixed] : [fixed, c]
        posts.push(mat([x, 0.55, z], [0.07, 1.1, 0.07]))
      }
      const mid = (from + to) / 2
      const len = Math.abs(to - from)
      rails.push(alongX ? mat([mid, 1.1, fixed], [len, 0.05, 0.06]) : mat([fixed, 1.1, mid], [0.06, 0.05, len]))
    }
    const fz = T.zFront + 0.3
    addRun(-T.entrance, T.x0, fz, true)
    addRun(T.entrance, T.x1, fz, true)
    // правый бок открыт к шатру: заборчик только за лаунжем, иначе в кадре 9
    // кустарник закрывал полкадра снизу
    addRun(-80, T.zBack, T.x1 + 0.3, false)
    return { boxes, hedges, hedgeColors, posts, rails }
  }, [T])

  /**
   * Посадка веранды по фотографиям: вдоль прохода стоят скамьи спинками к
   * ящикам с зеленью, перед ними столы «ёлочкой» и плетёные кресла; вдоль
   * левой перегородки — отдельный ряд столов. Проход по центру (между
   * ящиками) остаётся пустым: через веранду проходят в зал, и путь камеры
   * 2 → 3 → 4 идёт именно по нему.
   */
  const dining = useMemo(() => {
    const r = seeded(9)
    const out = {
      tops: [] as THREE.Matrix4[],
      legs: [] as THREE.Matrix4[],
      chairs: [] as THREE.Matrix4[],
      cushionColors: [] as THREE.Color[],
      benches: [] as THREE.Matrix4[],
      pillows: [] as THREE.Matrix4[],
      pillowColors: [] as THREE.Color[],
      glasses: [] as THREE.Matrix4[],
      candles: [] as THREE.Matrix4[],
      shadows: [] as THREE.Matrix4[],
    }
    const palette = ['#8fa3ad', '#e08a5a', '#e6dccb', '#5f9c95'].map((c) => new THREE.Color(c))
    // зелёные подушки — примета веранды на фото
    const pillowPalette = ['#2f7a4a', '#e0803f', '#2f7a4a', '#d9cdb8'].map((c) => new THREE.Color(c))
    const PROP_Y = DECK_Y + 0.78
    let k = 0
    /** Точка в локальных координатах стола, повёрнутого на theta вокруг Y */
    const at = (x: number, z: number, theta: number, lx: number, lz: number): [number, number, number] => [
      x + lx * Math.cos(theta) + lz * Math.sin(theta),
      PROP_Y,
      z - lx * Math.sin(theta) + lz * Math.cos(theta),
    ]
    const table = (x: number, z: number, theta: number) => {
      out.tops.push(mat([x, DECK_Y + 0.75, z], [1, 1, 1], theta))
      ;[-0.5, 0.5].forEach((d) => out.legs.push(mat([x + Math.cos(theta) * d, DECK_Y + 0.37, z - Math.sin(theta) * d], [1, 0.74, 1])))
      out.shadows.push(mat([x, DECK_Y + 0.02, z], [2.2, 1, 1.6], theta))
      out.glasses.push(mat(at(x, z, theta, 0.3, 0.16), [1, 1, 1]))
      out.glasses.push(mat(at(x, z, theta, 0.16, -0.2), [1, 1, 1]))
      out.candles.push(mat(at(x, z, theta, -0.34, 0.02), [1, 1, 1]))
    }
    const chair = (x: number, z: number, theta: number) => {
      out.chairs.push(mat([x, DECK_Y, z], [1, 1, 1], theta + (r() - 0.5) * 0.24))
      out.cushionColors.push(palette[k++ % palette.length])
      out.shadows.push(mat([x, DECK_Y + 0.02, z], [1.1, 1, 1.1], theta))
    }

    // [x скамьи, z, сторона прохода: −1 слева, +1 справа]. Слева пропуск
    // посередине: там сквозь настил растёт дерево в кашпо (−6.8, −81.6)
    const bays: [number, number, 1 | -1][] = [
      [-5.1, -75.8, -1],
      [-5.1, -78.8, -1],
      [-5.1, -85, -1],
      [3.3, -76.4, 1],
      [3.3, -79.6, 1],
      [3.3, -82.8, 1],
    ]
    bays.forEach(([bx, bz, dir]) => {
      const back = (dir * Math.PI) / 2
      out.benches.push(mat([bx, DECK_Y, bz], [1, 1, 1], back))
      out.shadows.push(mat([bx, DECK_Y + 0.02, bz], [1.4, 1, 3], back))
      ;[-0.62, 0.62].forEach((lz, i) => {
        out.pillows.push(mat([bx - dir * 0.28, DECK_Y + 0.66, bz + lz], [1, 1, 1], back, i ? 0.2 : -0.22))
        out.pillowColors.push(pillowPalette[(k + i) % pillowPalette.length])
      })
      const tx = bx + dir * 1.45
      table(tx, bz, Math.PI / 2)
      ;[-0.45, 0.45].forEach((dz) => chair(tx + dir * 1.35, bz + dz, (dir * Math.PI) / 2))
    })

    // ряд у левой перегородки и столик у входа
    const loose: [number, number][] = [
      [-9.9, -76.4],
      [-9.9, -80.6],
      [-9.9, -84.6],
      [-10.4, -73.4],
      [7.2, -75.2],
    ]
    loose.forEach(([x, z]) => {
      table(x, z, 0)
      chair(x, z - 0.95, Math.PI)
      chair(x, z + 0.95, 0)
    })
    return out
  }, [])

  /**
   * Ящики с зеленью вдоль прохода — главная примета веранды на фото:
   * длинные деревянные короба, из них плотной грядкой торчат зелёные и
   * бордовые листья. Они же отделяют проход от посадки.
   */
  const rails = useMemo(() => {
    const r = seeded(23)
    const boxes: THREE.Matrix4[] = []
    const leaves: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []
    // Зелень с приглушёнными бордовыми и рыжими вкраплениями, как на фото.
    // Насыщенный красный тут читается помидорами, а не листвой
    // Зелень — основа, бордовые и рыжие листья редкими вкраплениями: когда
    // их было по трети палитры, грядка читалась ящиком с яблоками
    const palette = ['#4f8f3f', '#3f7d33', '#6a9c42', '#79913a', '#58963c'].map((c) => new THREE.Color(c))
    const accents = ['#6b3a30', '#4f3348'].map((c) => new THREE.Color(c))
    for (const x of RAIL_X) {
      for (let z = -72.8; z > -85.4; z -= 2) boxes.push(mat([x, DECK_Y + 0.33, z - 1], [0.58, 0.66, 1.94]))
      // Мелко, часто и приплюснуто: шар даёт «пузырь», а сплющенный комок —
      // куст. Лист ≈ 0.15–0.3 м в поперечнике, шаг вдвое меньше листа
      for (let z = -72.8; z > -85.4; z -= 0.055) {
        const s = 0.07 + r() * 0.07
        leaves.push(mat([x + (r() - 0.5) * 0.5, DECK_Y + 0.62 + r() * 0.28, z + (r() - 0.5) * 0.16], [s, s * 0.55, s], r() * 3, r() * 3))
        const accent = r() < 0.14
        colors.push(accent ? accents[Math.floor(r() * accents.length)] : palette[Math.floor(r() * palette.length)])
      }
    }
    return { boxes, leaves, colors }
  }, [])

  /** Подвесные кашпо со свисающими плетями — рядами над ящиками */
  const baskets = useMemo(() => {
    const r = seeded(37)
    const pots: THREE.Matrix4[] = []
    const cords: THREE.Matrix4[] = []
    const leaves: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []
    const palette = ['#5fa049', '#4a8f3c', '#6aa84f', '#8fb84a'].map((c) => new THREE.Color(c))
    for (const x of RAIL_X) {
      for (const z of [-75.4, -79.4, -83.4]) {
        pots.push(mat([x, T.roofY - 0.62, z]))
        cords.push(mat([x, T.roofY - 0.31, z], [1, 0.62, 1]))
        for (let i = 0; i < 40; i++) {
          const a = r() * Math.PI * 2
          const rad = 0.08 + r() * 0.28
          const drop = Math.pow(r(), 1.6) * 0.72
          const s = 0.05 + r() * 0.07
          leaves.push(mat([x + Math.cos(a) * rad, T.roofY - 0.5 - drop, z + Math.sin(a) * rad], [s, s, s], r() * 3, r() * 3))
          colors.push(palette[Math.floor(r() * palette.length)])
        }
      }
    }
    return { pots, cords, leaves, colors }
  }, [T.roofY])

  // ── облако искусственных цветов над лаунжем ──
  const blooms = useMemo(() => {
    const r = seeded(29)
    const items: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []
    const palette = ['#e9a3b8', '#f3eee6', '#c7849a', '#f6c6d2', '#5f7f47', '#7d9a5c'].map((c) => new THREE.Color(c))
    // Много мелких «цветков», а не десяток крупных: крупные вблизи
    // выглядели как летающие камни
    const n = quality === 'high' ? 760 : 360
    for (let i = 0; i < n; i++) {
      const x = 8.6 + r() * 3.2
      const z = -76.8 - r() * 5.6
      // гуще у крыши, редкие «плети» свисают ниже
      const y = T.roofY - 0.1 - Math.pow(r(), 2.4) * 0.85
      // мельче и гуще: вблизи крупные помпоны читались ватными шариками
      const s = 0.024 + r() * 0.036
      items.push(mat([x, y, z], [s, s, s], r() * 3, r() * 3))
      colors.push(palette[Math.floor(r() * palette.length)])
    }
    // Гирлянда цветов по кромке навеса вдоль всего фасада: на фото она
    // свисает над ящиками с кустарником по обе стороны от входа. Над самим
    // входом просвет — туда входят, и камера кадра 3 идёт ровно там
    const m = quality === 'high' ? 620 : 300
    for (let i = 0; i < m; i++) {
      const x = T.x0 + r() * (T.x1 - T.x0)
      if (Math.abs(x) < T.entrance + 0.8) continue
      const s = 0.022 + r() * 0.032
      items.push(mat([x, T.roofY - 0.05 - Math.pow(r(), 1.7), T.zFront + 0.1 + (r() - 0.5) * 0.5], [s, s, s], r() * 3, r() * 3))
      colors.push(palette[Math.floor(r() * palette.length)])
    }
    return { items, colors }
  }, [T, quality])

  // ── цветы в ящиках вдоль фасада зала ──
  const flowerBed = useMemo(() => {
    const r = seeded(41)
    const boxes: THREE.Matrix4[] = []
    const leaves: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []
    const palette = ['#6b2a4a', '#a3243a', '#3f7a36', '#7fa84a', '#4c6b35'].map((c) => new THREE.Color(c))
    for (const x of [-11.6, -9.6, 7.6, 9.6]) {
      boxes.push(mat([x + 1, 0.2 + DECK_Y, T.zBack + 0.45], [1.9, 0.4, 0.5]))
      for (let k = 0; k < 9; k++) {
        const s = 0.16 + r() * 0.14
        leaves.push(mat([x + 0.15 + r() * 1.7, 0.55 + DECK_Y + r() * 0.2, T.zBack + 0.45 + (r() - 0.5) * 0.35], [s, s * 0.8, s], r() * 3))
        colors.push(palette[Math.floor(r() * palette.length)])
      }
    }
    return { boxes, leaves, colors }
  }, [T.zBack])

  const posts = [T.x0, -7.2, -T.entrance - 0.2, T.entrance + 0.2, 7.2, T.x1]

  const festoonSpans = useMemo<Span[]>(() => {
    const top = 4.6
    const eave = T.roofY + 0.05
    const [pA, pB, pC, pD] = POLES
    return [
      // над площадью — параллельно, от столбов к козырьку террасы
      [pA[0], top, pA[1], -10.5, eave, T.zFront],
      [pB[0], top, pB[1], -5, eave, T.zFront],
      [pC[0], top, pC[1], 5, eave, T.zFront],
      [pD[0], top, pD[1], 10.5, eave, T.zFront],
      [pA[0], top, pA[1], pB[0], top, pB[1]],
      [pB[0], top, pB[1], pC[0], top, pC[1]],
      [pC[0], top, pC[1], pD[0], top, pD[1]],
      // к деревьям по краям площади
      [-17, 4.4, -65, pA[0], top, pA[1]],
      [17.5, 4.4, -66.5, pD[0], top, pD[1]],
      [-17, 4.4, -65, T.x0, eave, T.zFront],
      [17.5, 4.4, -66.5, T.x1, eave, T.zFront],
      // по кромке маркиз
      [T.x0, eave, T.zFront, -T.entrance, eave, T.zFront],
      [T.entrance, eave, T.zFront, T.x1, eave, T.zFront],
      // под маркизами: ряды лампочек поперёк террасы
      [T.x0, T.roofY - 0.12, -76, T.x1, T.roofY - 0.12, -76],
      [T.x0, T.roofY - 0.12, -80.5, T.x1, T.roofY - 0.12, -80.5],
    ]
  }, [T])

  return (
    <group>
      {/* площадь */}
      <mesh rotation-x={-Math.PI / 2} position={[(SQUARE.x0 + SQUARE.x1) / 2, 0.035, (SQUARE.zNear + SQUARE.zFar) / 2]}>
        <planeGeometry args={[SQUARE.x1 - SQUARE.x0, SQUARE.zNear - SQUARE.zFar]} />
        <meshStandardMaterial map={tex.pavers} roughness={0.85} />
      </mesh>

      {/* столбы гирлянд */}
      {POLES.map(([x, z]) => (
        <mesh key={x} position={[x, 2.35, z]} material={steel}>
          <cylinderGeometry args={[0.05, 0.07, 4.7, 8]} />
        </mesh>
      ))}

      {/* лавочки у заборчика: деревянные рейки на чёрных опорах */}
      {[-7.4, -14.6, 14.6].map((x) => (
        <group key={x} position={[x, 0, T.zFront + 1.45]}>
          <mesh position={[0, 0.45, 0]} material={mats.frameWood}>
            <boxGeometry args={[1.8, 0.06, 0.46]} />
          </mesh>
          <mesh position={[0, 0.78, -0.22]} rotation-x={-0.12} material={mats.frameWood}>
            <boxGeometry args={[1.8, 0.34, 0.05]} />
          </mesh>
          {[-0.78, 0.78].map((dx) => (
            <mesh key={dx} position={[dx, 0.4, -0.04]} material={steel}>
              <boxGeometry args={[0.06, 0.8, 0.5]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* настил, ступень у входа и зелёный коврик */}
      <mesh position={[0, DECK_Y / 2, midZ]}>
        <boxGeometry args={[T.x1 - T.x0, DECK_Y, T.zFront - T.zBack]} />
        <meshStandardMaterial map={tex.deck} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.06, T.zFront + 0.4]}>
        <boxGeometry args={[T.entrance * 2 + 0.4, 0.12, 0.8]} />
        <meshStandardMaterial map={tex.deck} roughness={0.75} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, T.zFront + 1.55]}>
        <planeGeometry args={[2.6, 1.4]} />
        <meshStandardMaterial color="#2f8a36" roughness={1} />
      </mesh>

      {/* заборчик: ящики, кустарник, стойки и поручень */}
      <Instances items={fence.boxes} geometry={geos.box} material={mats.planter} />
      <Instances items={fence.hedges} geometry={geos.hedge} material={mats.hedge} colors={fence.hedgeColors} />
      <Instances items={fence.posts} geometry={geos.box} material={steel} />
      <Instances items={fence.rails} geometry={geos.box} material={steel} />

      {/* бетонные кубы с деревцами по бокам входа */}
      {[-2.95, 2.95, -12.9].map((x, i) => (
        <group key={x} position={[x, 0, i < 2 ? T.zFront + 1.1 : T.zFront + 1.2]}>
          <mesh position={[0, 0.5, 0]} material={mats.concrete}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.9, 0.04, 0.9]} />
            <meshStandardMaterial color="#231a12" roughness={1} />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[0.045, 0.06, 1.6, 6]} />
            <meshStandardMaterial color="#4a3a2c" roughness={1} />
          </mesh>
          <mesh position={[0, 2.85, 0]} scale={[0.85, 0.75, 0.85]} rotation-y={i * 1.9} geometry={geos.smallCrown} material={i === 1 ? mats.leafRed : mats.leafGreen} />
        </group>
      ))}

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
        <mesh key={x} position={[x, T.roofY + 0.04, midZ]} material={mats.rib}>
          <boxGeometry args={[0.08, 0.12, T.zFront - T.zBack]} />
        </mesh>
      ))}
      <Instances items={roof.pleat} geometry={geos.pleat} material={mats.awning} />
      <Instances items={roof.pleat} geometry={geos.pleat} material={mats.awningTop} />
      <Instances items={roof.wood} geometry={geos.panel} material={mats.ceiling} />
      {/* поперечные профили на стыках полотен: без них торцы складок
          читались пилой через весь потолок террасы */}
      {Array.from({ length: Math.round((T.zFront - T.zBack) / 2.8) - 1 }, (_, i) => T.zFront - 2.8 * (i + 1)).map((z) => (
        <mesh key={z} position={[0, T.roofY + 0.03, z]} material={mats.rib}>
          <boxGeometry args={[T.x1 - T.x0, 0.1, 0.09]} />
        </mesh>
      ))}

      {/* левый бок — реечная перегородка во всю длину */}
      <mesh position={[T.x0 - 0.05, 1.25 + DECK_Y, midZ]} rotation-y={Math.PI / 2} material={mats.screen}>
        <planeGeometry args={[T.zFront - T.zBack, 2.5]} />
      </mesh>
      {[T.zFront, -79, T.zBack].map((z) => (
        <mesh key={z} position={[T.x0 - 0.05, 1.45, z]} material={steel}>
          <boxGeometry args={[0.1, 2.9, 0.1]} />
        </mesh>
      ))}

      {/* ящики с зеленью вдоль прохода и подвесные кашпо над ними */}
      <Instances items={rails.boxes} geometry={geos.box} material={mats.planter} />
      <Instances items={rails.leaves} geometry={geos.bloom} material={mats.leafTint} colors={rails.colors} />
      <Instances items={baskets.cords} geometry={geos.cord} material={mats.rib} />
      <Instances items={baskets.pots} geometry={geos.pot} material={mats.pot} />
      <Instances items={baskets.leaves} geometry={geos.bloom} material={mats.leafTint} colors={baskets.colors} />

      {/* скамьи, столы, кресла и сервировка */}
      <Instances items={dining.shadows} geometry={geos.shadow} material={mats.contact} />
      <Instances items={dining.benches} geometry={geos.bench.frame} material={mats.benchWood} />
      <Instances items={dining.benches} geometry={geos.bench.cushion} material={mats.benchSeat} />
      <Instances items={dining.pillows} geometry={geos.pillow} material={mats.cushion} colors={dining.pillowColors} />
      <Instances items={dining.tops} geometry={geos.top} material={mats.herring} />
      <Instances items={dining.legs} geometry={geos.leg} material={steel} />
      <Instances items={dining.chairs} geometry={geos.chair.woven} material={mats.rattan} />
      <Instances items={dining.chairs} geometry={geos.chair.frame} material={mats.rattanSolid} />
      <Instances items={dining.chairs} geometry={geos.chair.cushion} material={mats.cushion} colors={dining.cushionColors} />
      <Instances items={dining.glasses} geometry={geos.glass} material={mats.glass} />
      <Instances items={dining.candles} geometry={geos.candle} material={mats.wax} />
      <Instances items={dining.candles} geometry={geos.flame} material={mats.flame} />

      {/* фасад зала со стороны веранды: тёмная реечная обшивка по бокам проёма */}
      {[-9.5, 9.5].map((x) => (
        <mesh key={x} position={[x, DECK_Y + 0.6, T.zBack + 0.1]} material={mats.planter}>
          <planeGeometry args={[5, 1.2]} />
        </mesh>
      ))}

      {/* плетёные подвесные лампы-корзины над столами */}
      {/* Только над левым рядом и у входа: над правым рядом лампа оказалась бы
          прямо на пути камеры 8 → 9, которая выходит из зала через веранду */}
      {[
        [-6.55, -77],
        [-6.55, -84.4],
        [-9.9, -80.6],
        [7.2, -75.2],
      ].map(([x, z]) => (
        // ключ по двум координатам: над левым рядом две лампы стоят на одном x
        <group key={`${x}${z}`} position={[x, T.roofY, z]}>
          <mesh position={[0, -0.35, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.7, 3]} />
            <meshBasicMaterial color="#111" />
          </mesh>
          <mesh position={[0, -0.72, 0]}>
            <sphereGeometry args={[0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#b88b4a" roughness={1} wireframe />
          </mesh>
          <mesh position={[0, -0.82, 0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color={[5, 3, 1.2]} toneMapped={false} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh
              key={k}
              position={[Math.cos(k * 1.26) * 0.3, -0.78 - (k % 2) * 0.12, Math.sin(k * 1.26) * 0.3]}
              scale={0.13}
              geometry={geos.bloom}
              material={mats.leafGreen}
            />
          ))}
        </group>
      ))}

      {/* ── лаунж справа ── */}
      {/* реечная перегородка позади и красные шторы на стойках */}
      <mesh position={[10.2, 1.3 + DECK_Y, -82.8]} material={mats.screen}>
        <planeGeometry args={[3.6, 2.6]} />
      </mesh>
      {[
        // в глубине лаунжа: ближе к фасаду штора закрывала бы шатёр в кадре 9
        [T.x1 - 0.1, -81.8, -Math.PI / 2],
        [8.5, -82.6, 0],
        [T.x0 + 0.6, T.zFront - 0.3, 0],
      ].map(([x, z, ry]) => (
        <mesh key={`${x}${z}`} geometry={geos.curtain} material={mats.red} position={[x, T.roofY / 2 + 0.05, z]} rotation-y={ry} />
      ))}
      {/* диваны: деревянная рама, серые подушки, оранжевые подушечки */}
      {[
        [10.6, -77.4, Math.PI],
        [10.6, -82, 0],
      ].map(([x, z, ry]) => (
        <group key={z} position={[x, DECK_Y, z]} rotation-y={ry}>
          {/* тень под диваном: без неё лаунж «висел» над настилом, пока
              у столов веранды тени уже были */}
          <mesh geometry={geos.shadow} material={mats.contact} position={[0, 0.02, 0]} scale={[3.2, 1, 1.9]} />
          <mesh position={[0, 0.22, 0]} material={mats.frameWood}>
            <boxGeometry args={[2.1, 0.12, 0.85]} />
          </mesh>
          <mesh position={[0, 0.36, 0.04]} material={mats.sofa}>
            <boxGeometry args={[1.9, 0.16, 0.72]} />
          </mesh>
          <mesh position={[0, 0.66, -0.34]} rotation-x={-0.12} material={mats.sofa}>
            <boxGeometry args={[1.9, 0.5, 0.16]} />
          </mesh>
          {[-1.02, 1.02].map((dx) => (
            <mesh key={dx} position={[dx, 0.4, 0]} material={mats.frameWood}>
              <boxGeometry args={[0.1, 0.5, 0.85]} />
            </mesh>
          ))}
          {[-0.5, 0.45].map((dx) => (
            <mesh key={dx} position={[dx, 0.6, -0.22]} rotation={[-0.3, 0, dx * 0.2]} material={mats.orange}>
              <boxGeometry args={[0.42, 0.36, 0.12]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[10.6, DECK_Y + 0.42, -79.7]} material={mats.frameWood}>
        <boxGeometry args={[1.5, 0.06, 0.8]} />
      </mesh>
      {/* свечи и стаканы на столике лаунжа — он стоял пустым */}
      {[
        [10.1, -79.9],
        [11.1, -79.5],
      ].map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={geos.candle} material={mats.wax} position={[x, DECK_Y + 0.45, z]} />
          <mesh geometry={geos.flame} material={mats.flame} position={[x, DECK_Y + 0.45, z]} />
        </group>
      ))}
      <mesh geometry={geos.glass} material={mats.glass} position={[10.6, DECK_Y + 0.45, -79.95]} />
      <mesh geometry={geos.shadow} material={mats.contact} position={[10.6, DECK_Y + 0.02, -79.7]} scale={[2.4, 1, 1.6]} />
      {/* красные кресла на гнутых деревянных полозьях */}
      {[
        [9.1, -79, Math.PI / 2 + 0.2],
        [9.1, -80.4, Math.PI / 2 - 0.2],
      ].map(([x, z, ry]) => (
        <group key={z} position={[x, DECK_Y, z]} rotation-y={ry}>
          {[-0.3, 0.3].map((dx) => (
            <mesh key={dx} position={[dx, 0.38, 0]} rotation-y={Math.PI / 2} material={mats.frameWood}>
              <torusGeometry args={[0.36, 0.03, 6, 14, Math.PI]} />
            </mesh>
          ))}
          <mesh position={[0, 0.46, 0.05]} rotation-x={0.12} material={mats.redSeat}>
            <boxGeometry args={[0.6, 0.14, 0.6]} />
          </mesh>
          <mesh position={[0, 0.78, -0.26]} rotation-x={-0.4} material={mats.redSeat}>
            <boxGeometry args={[0.6, 0.55, 0.14]} />
          </mesh>
        </group>
      ))}
      <Instances items={blooms.items} geometry={geos.bloom} material={mats.bloom} colors={blooms.colors} />

      {/* ящики с цветами вдоль стеклянного фасада зала */}
      <Instances items={flowerBed.boxes} geometry={geos.box} material={mats.planter} />
      <Instances items={flowerBed.leaves} geometry={geos.bloom} material={mats.bloom} colors={flowerBed.colors} />

      {/* обогреватели-пирамиды */}
      {/* у левой перегородки: в центре террасы трубка стояла прямо в кадре 3 */}
      {[
        [-11.3, -78.6],
        [-11.3, -82.4],
      ].map(([x, z]) => (
        // ключ по двум координатам: оба обогревателя стоят на x = −11.3
        <group key={`${x}${z}`} position={[x, DECK_Y, z]}>
          <mesh position={[0, 1.15, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.36, 2.3, 4, 1, true]} />
            <meshStandardMaterial color="#1c1c1f" metalness={0.8} roughness={0.35} wireframe />
          </mesh>
          {/* пламя в стеклянной трубке: тонкое и приглушённое, иначе bloom
              превращал его в светящийся «меч» через весь кадр */}
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.022, 0.03, 1.3, 8]} />
            <meshBasicMaterial color={[1.5, 0.5, 0.1]} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 1.5, 12, 1, true]} />
            <meshStandardMaterial color="#ffd9b0" transparent opacity={0.14} roughness={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[0, 2.32, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.28, 0.25, 4]} />
            <meshStandardMaterial color="#1c1c1f" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* белые фонари-домики со свечой */}
      {[
        [-2.7, -72.7],
        [2.7, -72.7],
        [-11.4, -85.4],
        [5, -79.2],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, DECK_Y, z]}>
          <mesh position={[0, 0.34, 0]}>
            <boxGeometry args={[0.34, 0.62, 0.34]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.6} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <torusGeometry args={[0.06, 0.015, 6, 12]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial color={[6, 3, 1]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Festoons spans={festoonSpans} density={quality === 'high' ? 1.6 : 1} />
      {/* Лампа в стороне от рёбер маркиз: прямо под ребром она давала
          яркую полосу-блик через весь кадр входа на террасу */}
      <pointLight position={[3.6, 2.2, -80.5]} color="#ffb870" intensity={10} distance={13} decay={1.5} />
    </group>
  )
}
