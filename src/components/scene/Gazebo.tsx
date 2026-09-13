'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'
import { GAZEBO } from './layout'

const curtainVertex = /* glsl */ `
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
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const curtainFragment = /* glsl */ `
  varying vec2 vUv;
  varying float vFold;
  void main() {
    float shade = 0.82 + 0.18 * vFold;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * shade, 0.42 + 0.12 * vFold);
  }
`

/**
 * Белый шатёр рядом с террасой: чёрный стальной каркас, тюлевые шторы,
 * которые колышутся на ветру (вершинный шейдер), красные бархатные
 * диваны и «люстра» из зелени с лампочками под крышей.
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
            uniforms={{ uTime: { value: 0 }, uPhase: { value: i * 1.7 } }}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* красные диваны буквой П и столик */}
      {[
        [cx + 2.6, cz, Math.PI / 2, 3.2],
        [cx, cz - 2.2, 0, 2.4],
        [cx, cz + 2.2, Math.PI, 2.4],
      ].map(([x, z, ry, len]) => (
        <group key={`${x}${z}`} position={[x, 0.16, z]} rotation-y={ry}>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[len, 0.42, 0.8]} />
            <meshStandardMaterial color="#8c1d24" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.66, -0.32]}>
            <boxGeometry args={[len, 0.55, 0.18]} />
            <meshStandardMaterial color="#7a171e" roughness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[cx, 0.6, cz]}>
        <boxGeometry args={[1.8, 0.06, 1.1]} />
        <meshStandardMaterial color="#6b442a" roughness={0.6} />
      </mesh>

      {/* люстра из зелени */}
      <group position={[cx, G.h - 0.6, cz]}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.55, Math.sin(i * 1.3) * 0.12, Math.sin(a) * 0.55]} scale={0.32}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={i % 3 ? '#4d7a45' : '#8aa7a0'} roughness={1} />
            </mesh>
          )
        })}
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + 0.3
          return (
            <mesh key={i} position={[Math.cos(a) * 0.4, -0.25, Math.sin(a) * 0.4]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color={[6, 3.6, 1.4]} toneMapped={false} />
            </mesh>
          )
        })}
      </group>
      <pointLight position={[cx, G.h - 0.8, cz]} color="#ffb46a" intensity={10} distance={10} decay={1.5} />
    </group>
  )
}
