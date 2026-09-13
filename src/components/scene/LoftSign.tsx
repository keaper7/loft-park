'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { SIGN } from './layout'
import { glowTexture, labelTexture } from './textures'

/**
 * Главная примета места — отдельно стоящие светящиеся буквы на площади:
 * LOFT, чёрная панель с зелёным листом, PARK; под LOFT подпись
 * «BAR & KITCHEN», под PARK — «TERRACE».
 *
 * Готового шрифта для 3D в three.js нет, поэтому буквы собраны из фигур
 * (прямоугольники, дуги, наклонные ноги) и выдавлены. Лицевая грань
 * светится (toneMapped=false → её подхватывает bloom), торцы — белые.
 */
const H = 1.35
const T = 0.3
const DEPTH = 0.32

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
/** Скруглённый справа прямоугольник с дыркой — «чаша» у P и R */
function bowl(w: number, y: number, h: number) {
  const r = h / 2
  const s = new THREE.Shape()
  s.moveTo(0, y).lineTo(w - r, y).absarc(w - r, y + r, r, -Math.PI / 2, Math.PI / 2, false).lineTo(0, y + h).closePath()
  const ri = r - T * 0.9
  const hole = new THREE.Path()
  hole.moveTo(T, y + T * 0.9).lineTo(w - r, y + T * 0.9).absarc(w - r, y + r, ri, -Math.PI / 2, Math.PI / 2, false).lineTo(T, y + h - T * 0.9).closePath()
  s.holes.push(hole)
  return s
}

type Glyph = { w: number; shapes: THREE.Shape[] }

function glyphs(): Record<string, Glyph> {
  const O = (() => {
    const w = 1.15
    const s = new THREE.Shape()
    s.absellipse(w / 2, H / 2, w / 2, H / 2, 0, Math.PI * 2, false, 0)
    const hole = new THREE.Path()
    hole.absellipse(w / 2, H / 2, w / 2 - T, H / 2 - T, 0, Math.PI * 2, true, 0)
    s.holes.push(hole)
    return { w, shapes: [s] }
  })()
  return {
    L: { w: 0.88, shapes: [rect(0, 0, T, H), rect(0, 0, 0.88, T)] },
    O,
    F: { w: 0.85, shapes: [rect(0, 0, T, H), rect(0, H - T, 0.85, T), rect(0, H / 2 - T / 2 + 0.04, 0.72, T * 0.9)] },
    T: { w: 0.98, shapes: [rect(0, H - T, 0.98, T), rect(0.49 - T / 2, 0, T, H)] },
    P: { w: 0.95, shapes: [rect(0, 0, T, H), bowl(0.95, H * 0.4, H * 0.6)] },
    A: {
      w: 1.15,
      shapes: [
        poly([[0, 0], [T * 1.2, 0], [0.575 + 0.02, H], [0.575 - T * 1.15, H]]),
        poly([[1.15, 0], [1.15 - T * 1.2, 0], [0.575 - 0.02, H], [0.575 + T * 1.15, H]]),
        rect(0.28, H * 0.26, 0.59, T * 0.8),
      ],
    },
    R: { w: 1.0, shapes: [rect(0, 0, T, H), bowl(0.95, H * 0.42, H * 0.58), poly([[T * 1.2, H * 0.45], [T * 1.2 + 0.36, H * 0.45], [1.0, 0], [1.0 - 0.38, 0]])] },
    K: {
      w: 1.0,
      shapes: [
        rect(0, 0, T, H),
        poly([[T * 0.8, H * 0.36], [T * 0.8 + 0.34, H * 0.36], [1.0, H], [1.0 - 0.4, H]]),
        poly([[T * 0.8 + 0.16, H * 0.6], [T * 0.8 + 0.46, H * 0.44], [1.0, 0], [1.0 - 0.4, 0]]),
      ],
    },
  }
}

function useWord(word: string) {
  return useMemo(() => {
    const g = glyphs()
    let x = 0
    const shapes: THREE.Shape[] = []
    for (const ch of word) {
      const gl = g[ch]
      gl.shapes.forEach((s) => {
        const moved = new THREE.Shape(s.getPoints(24).map((p) => new THREE.Vector2(p.x + x, p.y)))
        moved.holes = s.holes.map((h) => new THREE.Path(h.getPoints(24).map((p) => new THREE.Vector2(p.x + x, p.y))))
        shapes.push(moved)
      })
      x += gl.w + 0.1
    }
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false, curveSegments: 20 })
    return { geo, width: x - 0.1 }
  }, [word])
}

function leafShape(scale: number) {
  const s = new THREE.Shape()
  s.moveTo(0, -0.62 * scale)
  s.bezierCurveTo(0.5 * scale, -0.3 * scale, 0.5 * scale, 0.32 * scale, 0, 0.68 * scale)
  s.bezierCurveTo(-0.5 * scale, 0.32 * scale, -0.5 * scale, -0.3 * scale, 0, -0.62 * scale)
  return s
}
function leafOutline(scale: number, thickness: number) {
  const outer = leafShape(scale)
  const inner = leafShape(scale - thickness)
  outer.holes.push(new THREE.Path(inner.getPoints(40).reverse()))
  return outer
}

export function LoftSign() {
  const loft = useWord('LOFT')
  const park = useWord('PARK')

  const mats = useMemo(() => {
    const face = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 2.25, 2.1), toneMapped: false })
    const side = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.5 })
    return [face, side]
  }, [])
  const black = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.6, metalness: 0.2 }), [])
  const green = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.4, 0.7), toneMapped: false }), [])
  const leaf = useMemo(
    () => ({
      outer: new THREE.ExtrudeGeometry(leafOutline(1, 0.09), { depth: 0.04, bevelEnabled: false, curveSegments: 32 }),
      inner: new THREE.ExtrudeGeometry(leafOutline(0.62, 0.08), { depth: 0.04, bevelEnabled: false, curveSegments: 32 }),
    }),
    [],
  )
  const bar = useMemo(() => labelTexture('BAR & KITCHEN'), [])
  const terrace = useMemo(() => labelTexture('TERRACE'), [])
  const glow = useMemo(() => glowTexture(), [])

  const PLINTH = 0.34
  const GAP = 0.22
  const PANEL_W = 0.95
  const total = loft.width + GAP + PANEL_W + GAP + park.width
  const x0 = -total / 2
  const parkX = x0 + loft.width + GAP * 2 + PANEL_W

  return (
    <group position={[SIGN.x, 0, SIGN.z]} rotation-y={SIGN.rotY}>
      {/* постаменты с подписями */}
      <mesh position={[x0 + loft.width / 2, PLINTH / 2, 0.05]} material={black}>
        <boxGeometry args={[loft.width + 0.2, PLINTH, 0.6]} />
      </mesh>
      <mesh position={[x0 + loft.width - 0.62, PLINTH / 2, 0.36]}>
        <planeGeometry args={[1.1, 0.2]} />
        <meshBasicMaterial map={bar} />
      </mesh>
      <mesh position={[parkX + park.width / 2, PLINTH / 2, 0.05]} material={black}>
        <boxGeometry args={[park.width + 0.2, PLINTH, 0.6]} />
      </mesh>
      <mesh position={[parkX + park.width - 0.55, PLINTH / 2, 0.36]}>
        <planeGeometry args={[0.95, 0.2]} />
        <meshBasicMaterial map={terrace} />
      </mesh>

      {/* буквы */}
      <mesh geometry={loft.geo} material={mats} position={[x0, PLINTH, -DEPTH / 2]} />
      <mesh geometry={park.geo} material={mats} position={[parkX, PLINTH, -DEPTH / 2]} />

      {/* чёрная панель с листом */}
      <group position={[x0 + loft.width + GAP + PANEL_W / 2, 0, 0]}>
        <mesh position={[0, 0.98, 0]} material={black}>
          <boxGeometry args={[PANEL_W, 1.96, 0.42]} />
        </mesh>
        <mesh geometry={leaf.outer} material={green} position={[0, 1.02, 0.21]} />
        <mesh geometry={leaf.inner} material={green} position={[0, 0.98, 0.21]} />
        <mesh position={[0, 0.82, 0.235]} material={green}>
          <boxGeometry args={[0.035, 0.62, 0.02]} />
        </mesh>
      </group>

      {/* свет букв на плитке */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 1.4]}>
        <planeGeometry args={[total + 3, 4]} />
        <meshBasicMaterial map={glow} color="#fff3e0" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
