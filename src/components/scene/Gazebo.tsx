'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'
import { GAZEBO } from './layout'
import { Instances, mat, seeded } from './instancing'
import { puffGeometry } from './foliage'

// Туман подключён штатными чанками three.js: без него шторы с аллеи
// горели белой стеной сквозь ночную дымку
const curtainVertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vFold;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Штора висит сверху: чем ниже точка, тем сильнее её качает ветер
    float hang = pow(1.0 - uv.y, 1.4);
    float folds = sin(uv.x * 38.0) * 0.05;
    float wind = sin(uv.x * 5.0 + uTime * 1.6 + uPhase) * 0.18 + sin(uv.x * 11.0 - uTime * 2.3 + uPhase) * 0.06;
    p.z += folds + wind * hang;
    vFold = sin(uv.x * 38.0);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const curtainFragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec2 vUv;
  varying float vFold;
  void main() {
    float shade = 0.75 + 0.25 * vFold;
    // Ночью тюль — полупрозрачная ткань, подсвеченная сверху лампочками в
    // «облаке» цветов: теплее и ярче у крыши, темнее к полу. Прежний почти
    // белый цвет на фоне ночной сцены горел сплошной белой стеной.
    float lit = mix(0.16, 0.42, smoothstep(0.1, 1.0, vUv.y));
    gl_FragColor = vec4(vec3(0.95, 0.78, 0.58) * lit * shade, 0.36 + 0.12 * vFold);
    #include <fog_fragment>
  }
`

/**
 * Белый шатёр рядом с террасой (по фото гостей): чёрный стальной каркас,
 * тюлевые шторы, которые колышутся на ветру (вершинный шейдер), серые
 * диваны на деревянной раме с оранжевыми подушками, красные кресла на
 * гнутых полозьях и «облако» искусственных цветов под крышей.
 */
export function Gazebo() {
  const G = GAZEBO
  const cx = (G.x0 + G.x1) / 2
  const cz = (G.zNear + G.zFar) / 2
  const w = G.x1 - G.x0
  const d = G.zNear - G.zFar
  const mats = useRef<THREE.ShaderMaterial[]>([])

  const curtains = useMemo(
    () => [
      // задняя сторона и правая — сплошные; к террасе (x0) — подхваченные у стоек
      { pos: [G.x1, G.h / 2, cz], rotY: -Math.PI / 2, width: d },
      { pos: [cx, G.h / 2, G.zFar], rotY: 0, width: w },
      { pos: [cx, G.h / 2, G.zNear], rotY: Math.PI, width: w },
      { pos: [G.x0, G.h / 2, G.zNear - 1.2], rotY: Math.PI / 2, width: 2.2 },
      { pos: [G.x0, G.h / 2, G.zFar + 1.2], rotY: Math.PI / 2, width: 2.2 },
    ],
    [G, cx, cz, d, w],
  )

  const bloomGeo = useMemo(() => puffGeometry(), [])
  const bloomMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), [])
  const blooms = useMemo(() => {
    const r = seeded(57)
    const palette = ['#e9a3b8', '#f3eee6', '#c7849a', '#9fb3ad', '#5f7f47', '#7d9a5c'].map((c) => new THREE.Color(c))
    const items: THREE.Matrix4[] = []
    const colors: THREE.Color[] = []
    for (let i = 0; i < 520; i++) {
      const s = 0.026 + r() * 0.042
      // гуще у крыши, редкие «плети» свисают ниже
      items.push(mat([G.x0 + 0.6 + r() * (w - 1.2), G.h - 0.1 - Math.pow(r(), 2.2) * 0.9, G.zFar + 0.6 + r() * (d - 1.2)], [s, s, s], r() * 3, r() * 3))
      colors.push(palette[Math.floor(r() * palette.length)])
    }
    return { items, colors }
  }, [G, w, d])

  const curtainUniforms = useMemo(
    () => curtains.map((_, i) => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uPhase: { value: i * 1.7 } })),
    [curtains],
  )

  useFrame((_, dt) => {
    if (fx.reduced) return
    mats.current.forEach((m) => m && (m.uniforms.uTime.value += dt))
  })

  const steel = <meshStandardMaterial color="#141416" metalness={0.7} roughness={0.4} />

  return (
    <group>
      <mesh position={[cx, 0.08, cz]}>
        <boxGeometry args={[w, 0.16, d]} />
        <meshStandardMaterial color="#3a2a1d" roughness={0.9} />
      </mesh>
      {[
        [G.x0, G.zNear],
        [G.x1, G.zNear],
        [G.x0, G.zFar],
        [G.x1, G.zFar],
        [G.x0, cz],
        [G.x1, cz],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, G.h / 2, z]}>
          <boxGeometry args={[0.12, G.h, 0.12]} />
          {steel}
        </mesh>
      ))}
      {[G.zNear, G.zFar, cz].map((z) => (
        <mesh key={z} position={[cx, G.h, z]}>
          <boxGeometry args={[w + 0.12, 0.12, 0.12]} />
          {steel}
        </mesh>
      ))}
      {[G.x0, G.x1, cx].map((x) => (
        <mesh key={x} position={[x, G.h, cz]}>
          <boxGeometry args={[0.12, 0.12, d]} />
          {steel}
        </mesh>
      ))}
      <mesh position={[cx, G.h + 0.02, cz]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f3efe6" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {curtains.map((c, i) => (
        <mesh key={i} position={c.pos as [number, number, number]} rotation-y={c.rotY}>
          <planeGeometry args={[c.width, G.h - 0.1, 40, 12]} />
          <shaderMaterial
            ref={(el) => {
              if (el) mats.current[i] = el
            }}
            vertexShader={curtainVertex}
            fragmentShader={curtainFragment}
            uniforms={curtainUniforms[i]}
            fog
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* серые диваны на деревянной раме; спинка у локального −z */}
      {[
        [G.x1 - 0.7, cz - 1.6, -Math.PI / 2, 3],
        [cx - 0.4, G.zFar + 0.8, 0, 3.2],
      ].map(([x, z, ry, len]) => (
        <group key={`${x}${z}`} position={[x, 0.16, z]} rotation-y={ry}>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[len + 0.2, 0.12, 0.85]} />
            <meshStandardMaterial color="#9a6436" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.36, 0.04]}>
            <boxGeometry args={[len, 0.16, 0.72]} />
            <meshStandardMaterial color="#8d8b86" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.66, -0.34]} rotation-x={-0.12}>
            <boxGeometry args={[len, 0.5, 0.16]} />
            <meshStandardMaterial color="#8d8b86" roughness={0.95} />
          </mesh>
          {[-len / 3, len / 4].map((dx) => (
            <mesh key={dx} position={[dx, 0.6, -0.22]} rotation={[-0.3, 0, 0.1]}>
              <boxGeometry args={[0.42, 0.36, 0.12]} />
              <meshStandardMaterial color="#e0803f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* красные кресла на гнутых полозьях */}
      {[
        [G.x1 - 3, cz - 2.5, Math.PI / 2 + 0.3],
        [G.x1 - 3, cz - 0.7, Math.PI / 2 - 0.3],
        [cx - 1.6, G.zFar + 2.7, Math.PI - 0.2],
      ].map(([x, z, ry]) => (
        <group key={`${x}${z}`} position={[x, 0.16, z]} rotation-y={ry}>
          {[-0.3, 0.3].map((dx) => (
            <mesh key={dx} position={[dx, 0.38, 0]} rotation-y={Math.PI / 2}>
              <torusGeometry args={[0.36, 0.03, 6, 14, Math.PI]} />
              <meshStandardMaterial color="#9a6436" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.46, 0.05]} rotation-x={0.12}>
            <boxGeometry args={[0.6, 0.14, 0.6]} />
            <meshStandardMaterial color="#b5202a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.78, -0.26]} rotation-x={-0.4}>
            <boxGeometry args={[0.6, 0.55, 0.14]} />
            <meshStandardMaterial color="#b5202a" roughness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[G.x1 - 2, 0.6, cz - 1.6]}>
        <boxGeometry args={[0.9, 0.06, 1.6]} />
        <meshStandardMaterial color="#6b442a" roughness={0.6} />
      </mesh>

      {/* «облако» цветов и зелени под крышей и лампочки в нём */}
      <Instances items={blooms.items} geometry={bloomGeo} material={bloomMat} colors={blooms.colors} />
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[G.x0 + 1 + ((i * 2.9) % (w - 2)), G.h - 0.55 - (i % 3) * 0.12, G.zFar + 1 + ((i * 4.3) % (d - 2))]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshBasicMaterial color={[6, 3.6, 1.4]} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[cx, G.h - 0.8, cz]} color="#ffb46a" intensity={10} distance={10} decay={1.5} />
    </group>
  )
}
