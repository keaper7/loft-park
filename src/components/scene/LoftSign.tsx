'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { SIGN } from './layout'
import { glowTexture } from './textures'

/**
 * Главная примета места — отдельно стоящие буквы на площади. По фото:
 * - белые лицевые грани (ночью светятся), чёрные торцы;
 * - каждое слово стоит на чёрном постаменте со скошенной передней гранью,
 *   на ней мелкие белые подписи: «BAR & KITCHEN» под LOFT, «TERRACE» под PARK;
 * - между словами — зелёная эмблема-капля: остриё сверху, внутри вторая
 *   капля и прожилка листа. Ночью светится зелёным контуром.
 *
 * Готового шрифта для 3D в three.js нет, поэтому буквы собраны из фигур
 * (прямоугольники, дуги, наклонные ноги) и выдавлены. Те же глифы и
 * эмблема висят на стене из мха в зале (Hall.tsx) — отсюда экспорт.
 */

const rect = (x: number, y: number, w: number, h: number) => {
  const s = new THREE.Shape()
  s.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).closePath()
  return s
}
const poly = (pts: [number, number][]) => {
  const s = new THREE.Shape()
  s.moveTo(...pts[0])
  pts.slice(1).forEach((p) => s.lineTo(...p))
  s.closePath()
  return s
}

type Glyph = { w: number; shapes: THREE.Shape[] }

function glyphs(H: number, T: number): Record<string, Glyph> {
  /** Скруглённая справа «чаша» с дыркой — у P и R */
  const bowl = (w: number, y: number, h: number) => {
    const r = h / 2
    const s = new THREE.Shape()
    s.moveTo(0, y).lineTo(w - r, y).absarc(w - r, y + r, r, -Math.PI / 2, Math.PI / 2, false).lineTo(0, y + h).closePath()
    const t = T * 0.85
    const hole = new THREE.Path()
    hole.moveTo(T, y + t).lineTo(w - r, y + t).absarc(w - r, y + r, r - t, -Math.PI / 2, Math.PI / 2, false).lineTo(T, y + h - t).closePath()
    s.holes.push(hole)
    return s
  }
  // Пропорции сняты с фронтальных фото: гротеск плотный, буквы узкие,
  // «O» почти круглое. LOFT ≈ 2.5 высоты буквы, PARK ≈ 3.
  const k = H / 1.25
  const O = (() => {
    const w = 1.1 * k
    const s = new THREE.Shape()
    s.absellipse(w / 2, H / 2, w / 2, H / 2, 0, Math.PI * 2, false, 0)
    const hole = new THREE.Path()
    hole.absellipse(w / 2, H / 2, w / 2 - T * 1.05, H / 2 - T * 0.95, 0, Math.PI * 2, true, 0)
    s.holes.push(hole)
    return { w, shapes: [s] }
  })()
  const A = 1.06 * k
  const R = 0.88 * k
  return {
    L: { w: 0.56 * k, shapes: [rect(0, 0, T, H), rect(0, 0, 0.56 * k, T)] },
    O,
    F: { w: 0.6 * k, shapes: [rect(0, 0, T, H), rect(0, H - T, 0.6 * k, T), rect(0, H / 2 - T / 2 + 0.03 * k, 0.52 * k, T * 0.9)] },
    T: { w: 0.7 * k, shapes: [rect(0, H - T, 0.7 * k, T), rect(0.35 * k - T / 2, 0, T, H)] },
    P: { w: 0.74 * k, shapes: [rect(0, 0, T, H), bowl(0.74 * k, H * 0.4, H * 0.6)] },
    A: {
      w: A,
      shapes: [
        poly([[0, 0], [T * 1.15, 0], [A / 2 + 0.02, H], [A / 2 - T * 1.1, H]]),
        poly([[A, 0], [A - T * 1.15, 0], [A / 2 - 0.02, H], [A / 2 + T * 1.1, H]]),
        rect(A * 0.26, H * 0.24, A * 0.48, T * 0.8),
      ],
    },
    R: {
      w: R,
      shapes: [rect(0, 0, T, H), bowl(0.84 * k, H * 0.42, H * 0.58), poly([[T * 1.05, H * 0.46], [T * 1.05 + 0.3 * k, H * 0.46], [R, 0], [R - 0.33 * k, 0]])],
    },
    K: {
      w: R,
      shapes: [
        rect(0, 0, T, H),
        poly([[T * 0.8, H * 0.36], [T * 0.8 + 0.3 * k, H * 0.36], [R, H], [R - 0.34 * k, H]]),
        poly([[T * 0.8 + 0.13 * k, H * 0.6], [T * 0.8 + 0.4 * k, H * 0.44], [R, 0], [R - 0.34 * k, 0]]),
      ],
    },
  }
}

/** Слово из выдавленных глифов. Группы геометрии: 0 — лицо и тыл, 1 — торцы */
export function buildWord(word: string, H: number, T: number, depth: number, gap = 0.07) {
  const g = glyphs(H, T)
  let x = 0
  const shapes: THREE.Shape[] = []
  for (const ch of word) {
    const gl = g[ch]
    gl.shapes.forEach((s) => {
      const moved = new THREE.Shape(s.getPoints(24).map((p) => new THREE.Vector2(p.x + x, p.y)))
      moved.holes = s.holes.map((h) => new THREE.Path(h.getPoints(24).map((p) => new THREE.Vector2(p.x + x, p.y))))
      shapes.push(moved)
    })
    x += gl.w + gap
  }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 20 })
  return { geo, width: x - gap }
}

/** Капля эмблемы: остриё сверху, круглое дно. Центр — в начале координат */
export function dropShape(h: number, w: number, cx = 0, cy = 0) {
  const r = w / 2
  const top = h / 2
  const c = -h / 2 + r
  const s = new THREE.Shape()
  s.moveTo(cx, cy + top)
  s.bezierCurveTo(cx + r * 0.35, cy + top - h * 0.18, cx + r, cy + c + h * 0.2, cx + r, cy + c)
  s.absarc(cx, cy + c, r, 0, Math.PI, true)
  s.bezierCurveTo(cx - r, cy + c + h * 0.2, cx - r * 0.35, cy + top - h * 0.18, cx, cy + top)
  return s
}

/** Контур капли толщиной t (кольцо) */
export function dropRing(h: number, w: number, t: number, cy = 0) {
  const outer = dropShape(h, w, 0, cy)
  const inner = dropShape(h - t * 2.4, w - t * 2, 0, cy - t * 0.15)
  outer.holes.push(new THREE.Path(inner.getPoints(48).reverse()))
  return outer
}

/** Эмблема-лист: внешний контур, внутренняя капля, прожилка и две «галочки» */
export function useEmblem(h: number, w: number) {
  return useMemo(() => {
    const t = w * 0.075
    const opts = { depth: 0.03, bevelEnabled: false, curveSegments: 32 }
    const rings = new THREE.ExtrudeGeometry([dropRing(h, w, t), dropRing(h * 0.62, w * 0.6, t * 0.85, -h * 0.06)], opts)
    const vein = new THREE.ExtrudeGeometry(
      [
        rect(-t * 0.45, -h * 0.34, t * 0.9, h * 0.55),
        // «галочки» прожилок: две наклонные планки от центральной линии
        poly([[-t * 0.45, -h * 0.1], [t * 0.45, -h * 0.1], [w * 0.2, h * 0.06], [w * 0.2 - t, h * 0.06 + t * 0.4]]),
        poly([[t * 0.45, -h * 0.1], [-t * 0.45, -h * 0.1], [-w * 0.2, h * 0.06], [-w * 0.2 + t, h * 0.06 + t * 0.4]]),
      ],
      opts,
    )
    const body = new THREE.ExtrudeGeometry(dropShape(h, w), { depth: 0.2, bevelEnabled: false, curveSegments: 32 })
    return { rings, vein, body }
  }, [h, w])
}

/** Постамент: брус со скошенной передней гранью, вдоль оси X */
function plinthGeometry(width: number, height: number) {
  // Профиль в плоскости (−z, y); после rotateY(π/2) выдавливание идёт по X
  const s = poly([
    [-0.3, 0],
    [0.28, 0],
    [0.28, height],
    [-0.08, height],
  ])
  const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false })
  geo.rotateY(Math.PI / 2)
  geo.translate(-width / 2, 0, 0)
  return geo
}

/** Подпись на скошенной грани: белые разреженные буквы на прозрачном фоне */
function captionTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f1ea'
  g.font = '700 92px Onest, Unbounded, sans-serif'
  ;(g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 512, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const H = 1.25
const T = 0.27
const DEPTH = 0.28
const PLINTH_H = 0.42
// передняя грань постамента уходит назад на 0.22 м по высоте 0.42
const SLOPE = Math.atan2(0.22, PLINTH_H)
const EMBLEM_H = 1.62
const EMBLEM_W = 0.86

export function LoftSign() {
  const loft = useMemo(() => buildWord('LOFT', H, T, DEPTH), [])
  const park = useMemo(() => buildWord('PARK', H, T, DEPTH), [])
  const emblem = useEmblem(EMBLEM_H, EMBLEM_W)

  const mats = useMemo(() => {
    const face = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 2.1, 2.02), toneMapped: false })
    const side = new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.55, metalness: 0.2 })
    return { letters: [face, side], black: side }
  }, [])
  const green = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 2.6, 0.8), toneMapped: false }), [])
  const greenBody = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0b2e1a', roughness: 0.5, emissive: '#06331a', emissiveIntensity: 0.6 }), [])
  const bar = useMemo(() => captionTexture('BAR & KITCHEN'), [])
  const terrace = useMemo(() => captionTexture('TERRACE'), [])
  const glow = useMemo(() => glowTexture(), [])

  const GAP = 0.1
  const total = loft.width + GAP + EMBLEM_W + GAP + park.width
  const x0 = -total / 2
  const loftCx = x0 + loft.width / 2
  const parkX = x0 + loft.width + GAP * 2 + EMBLEM_W
  const parkCx = parkX + park.width / 2
  const plinthLoft = useMemo(() => plinthGeometry(loft.width + 0.24, PLINTH_H), [loft.width])
  const plinthPark = useMemo(() => plinthGeometry(park.width + 0.24, PLINTH_H), [park.width])

  // Центр скошенной грани постамента: на ней лежат подписи
  const captionZ = 0.19 + 0.012
  const captionY = PLINTH_H / 2

  return (
    <group position={[SIGN.x, 0, SIGN.z]} rotation-y={SIGN.rotY}>
      <mesh geometry={plinthLoft} material={mats.black} position={[loftCx, 0, 0]} />
      <mesh geometry={plinthPark} material={mats.black} position={[parkCx, 0, 0]} />
      {/* подписи: BAR & KITCHEN — под «OFT», TERRACE — под «RK», как на фото */}
      <mesh position={[loftCx + 0.2, captionY, captionZ]} rotation-x={-SLOPE}>
        <planeGeometry args={[2.3, 0.29]} />
        <meshBasicMaterial map={bar} transparent depthWrite={false} />
      </mesh>
      <mesh position={[parkX + park.width - 0.85, captionY, captionZ]} rotation-x={-SLOPE}>
        <planeGeometry args={[1.9, 0.24]} />
        <meshBasicMaterial map={terrace} transparent depthWrite={false} />
      </mesh>

      {/* буквы стоят на постаменте, их низ спрятан за скосом */}
      <mesh geometry={loft.geo} material={mats.letters} position={[x0, PLINTH_H - 0.04, -0.22]} />
      <mesh geometry={park.geo} material={mats.letters} position={[parkX, PLINTH_H - 0.04, -0.22]} />

      {/* эмблема: тёмно-зелёная капля и светящийся контур листа */}
      <group position={[x0 + loft.width + GAP + EMBLEM_W / 2, EMBLEM_H / 2 + 0.06, -0.14]}>
        <mesh geometry={emblem.body} material={greenBody} />
        <mesh geometry={emblem.rings} material={green} position-z={0.2} />
        <mesh geometry={emblem.vein} material={green} position-z={0.2} />
      </group>

      {/* свет букв на плитке */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 1.5]}>
        <planeGeometry args={[total + 3, 4]} />
        <meshBasicMaterial map={glow} color="#fff3e0" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
