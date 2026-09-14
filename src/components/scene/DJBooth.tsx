'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { vinylTexture } from './textures'
import { fx, smoothstep } from './fx'

const Z = -99.6

const eqFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float bars = 28.0;
    float id = floor(vUv.x * bars);
    float fx = fract(vUv.x * bars);
    float h = 0.15 + 0.85 * abs(sin(uTime * (1.2 + mod(id * 1.7, 3.0)) + id * 0.9)) * (0.55 + 0.45 * sin(uTime * 0.7 + id));
    float on = step(vUv.y, h) * step(0.18, fx) * step(fx, 0.82) * step(0.3, fract(vUv.y * 12.0));
    vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.18, 0.5), vUv.y);
    gl_FragColor = vec4(col * on * 2.6 + vec3(0.015), 1.0);
  }
`
const eqVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float a = pow(vUv.y, 1.6) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`

/**
 * DJ-зона в глубине зала: пульт с двумя вертушками, LED-панель-эквалайзер
 * (шейдер, без текстур), неоновое кольцо на стене и лучи прожекторов.
 * Пластинки крутятся с базовой скоростью 33⅓ и ускоряются от скролла —
 * крутишь страницу, «скретчишь» винил.
 */
export function DJBooth() {
  const vinylMap = useMemo(() => vinylTexture(), [])
  const decks = useRef<(THREE.Mesh | null)[]>([])
  const eq = useRef<THREE.ShaderMaterial>(null)
  const beams = useRef<(THREE.Group | null)[]>([])
  const beamMats = useRef<(THREE.ShaderMaterial | null)[]>([])
  const neon = useRef<THREE.MeshBasicMaterial>(null)

  const vinylMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: vinylMap, roughness: 0.3, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: '#0b0b0b' }),
    ],
    [vinylMap],
  )

  const eqUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const beamUniforms = useMemo(
    () =>
      ['#ffb561', '#ff3d8b', '#ffb561', '#ff3d8b'].map((c) => ({
        uColor: { value: new THREE.Color(c).multiplyScalar(1.6) },
        uOpacity: { value: 0.2 },
      })),
    [],
  )

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const near = smoothstep(6.5, 8, fx.cam) * (1 - smoothstep(8.6, 9.6, fx.cam))
    const speed = fx.reduced ? 0 : 3.49 + Math.abs(scrollState.velocity) * 0.08
    decks.current.forEach((d, i) => d && (d.rotation.y -= dt * speed * (i ? 1.03 : 1)))
    if (eq.current && !fx.reduced) eq.current.uniforms.uTime.value = t
    beams.current.forEach((b, i) => {
      if (!b) return
      if (!fx.reduced) {
        b.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.45
        b.rotation.x = 0.35 + Math.cos(t * 0.6 + i) * 0.2
      }
      const m = beamMats.current[i]
      // лучи не должны заливать буквы на стене из мха
      if (m) m.uniforms.uOpacity.value = 0.02 + near * 0.12
    })
    if (neon.current) {
      const hue = fx.reduced ? 0.06 : 0.92 + Math.sin(t * 0.4) * 0.08
      neon.current.color.setHSL(hue % 1, 1, 0.5).multiplyScalar(2.6 + near)
    }
  })

  return (
    <group>
      {/* пульт */}
      <mesh position={[0, 0.55, Z]}>
        <boxGeometry args={[4, 1.1, 1.2]} />
        <meshStandardMaterial color="#121214" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.55, Z + 0.61]}>
        <planeGeometry args={[3.8, 0.9]} />
        <shaderMaterial ref={eq} vertexShader={eqVertex} fragmentShader={eqFragment} uniforms={eqUniforms} toneMapped={false} />
      </mesh>
      {[-1.05, 1.05].map((x, i) => (
        <group key={x} position={[x, 1.12, Z]}>
          <mesh>
            <boxGeometry args={[1.05, 0.05, 0.95]} />
            <meshStandardMaterial color="#2a2a2e" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh
            position={[-0.05, 0.05, 0]}
            material={vinylMats}
            ref={(el) => {
              decks.current[i] = el
            }}
          >
            <cylinderGeometry args={[0.4, 0.4, 0.02, 48]} />
          </mesh>
          <mesh position={[0.38, 0.1, -0.3]} rotation={[0, 0.5, Math.PI / 2 - 0.05]}>
            <cylinderGeometry args={[0.012, 0.012, 0.55, 6]} />
            <meshStandardMaterial color="#b8b8bc" metalness={1} roughness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.16, Z]}>
        <boxGeometry args={[0.7, 0.1, 0.8]} />
        <meshStandardMaterial color="#1a1a1c" metalness={0.6} roughness={0.4} />
      </mesh>

      <pointLight position={[0, 2.4, -99]} color="#ff4f9a" intensity={6} distance={8} decay={1.5} />

      {/* лучи прожекторов */}
      {[-3, -1, 1, 3].map((x, i) => (
        <group
          key={x}
          position={[x, 3.7, -98.5]}
          ref={(el) => {
            beams.current[i] = el
          }}
        >
          <mesh position={[0, -1.6, 0]}>
            <coneGeometry args={[0.42, 3.2, 24, 1, true]} />
            <shaderMaterial
              ref={(el) => {
                beamMats.current[i] = el
              }}
              vertexShader={eqVertex}
              fragmentShader={beamFragment}
              uniforms={beamUniforms[i]}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
