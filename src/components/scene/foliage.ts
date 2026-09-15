import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seeded } from './instancing'

/** Гладкий value-noise для смещения вершин: крона не должна быть шаром */
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const f = (v: number) => v * v * (3 - 2 * v)
  const fx = f(x - ix)
  const fy = f(y - iy)
  const fz = f(z - iz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  )
}

/**
 * Крона: несколько сросшихся «облаков» листвы с бугристой поверхностью.
 * Вершины сварены (mergeVertices) — нормали гладкие, без граней-многогранника,
 * которые делали деревья похожими на зелёные камни. Радиус ≈ 1.
 */
export function crownGeometry(seed: number, lumps: number, detail: number) {
  const r = seeded(seed)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < lumps; i++) {
    const g = new THREE.IcosahedronGeometry(1, detail)
    const s = i === 0 ? 0.78 : 0.42 + r() * 0.3
    const a = r() * Math.PI * 2
    const d = i === 0 ? 0 : 0.42 + r() * 0.26
    g.scale(s, s * 0.82, s)
    g.translate(Math.cos(a) * d, (r() - 0.4) * 0.45, Math.sin(a) * d)
    parts.push(g)
  }
  let g = mergeGeometries(parts)!
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const n = noise3(x * 2.4 + seed, y * 2.4, z * 2.4) * 0.65 + noise3(x * 6 + seed, y * 6, z * 6) * 0.35
    const k = 1 + (n - 0.5) * 0.34
    p.setXYZ(i, x * k, y * k, z * k)
  }
  g.computeVertexNormals()
  g.computeBoundingSphere()
  const R = g.boundingSphere!.radius
  g.scale(1 / R, 1 / R, 1 / R)
  g.computeBoundingSphere()
  return g
}

/** Помпон для «облаков» искусственных цветов: мягкий, а не гранёный */
export function puffGeometry() {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 1)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const k = 0.85 + noise3(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3) * 0.3
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Листва: поверх цвета инстанса — пятна света и тени в мировых координатах,
 * как просветы между листьями. Без текстур и без прозрачности.
 */
export function foliageMaterial(params: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, ...params })
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vLeafPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vLeafPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      )
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vLeafPos;
        float leafHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float leafNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(leafHash(i), leafHash(i + vec3(1, 0, 0)), f.x), mix(leafHash(i + vec3(0, 1, 0)), leafHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(leafHash(i + vec3(0, 0, 1)), leafHash(i + vec3(1, 0, 1)), f.x), mix(leafHash(i + vec3(0, 1, 1)), leafHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float leafBig = leafNoise(vLeafPos * 1.7);
        float leafFine = leafNoise(vLeafPos * 6.5);
        diffuseColor.rgb *= 0.45 + 0.9 * leafBig * (0.55 + 0.45 * leafFine);`,
      )
  }
  m.customProgramCacheKey = () => 'foliage'
  return m
}
