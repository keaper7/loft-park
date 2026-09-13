'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aScale;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // Каждый светлячок летает по своей петле: фазы разные, частоты общие
    p.y += sin(uTime * 0.55 + aPhase * 6.2831) * 0.45;
    p.x += cos(uTime * 0.37 + aPhase * 12.0) * 0.35;
    p.z += sin(uTime * 0.29 + aPhase * 20.0) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio / -mv.z;
    vAlpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 40.0), 3.0);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float glow = 0.05 / d - 0.1;
    if (glow <= 0.0) discard;
    gl_FragColor = vec4(uColor * 2.2, glow * vAlpha);
  }
`

/**
 * Светлячки — GPU-частицы: вся анимация в вершинном шейдере, CPU только
 * двигает uTime. Тысяча точек стоит один draw call.
 */
export function Fireflies({
  count = 600,
  area = [60, 5, 90],
  center = [0, 2.2, -28],
  color = '#ffc56b',
  size = 140,
}: {
  count?: number
  area?: [number, number, number]
  center?: [number, number, number]
  color?: string
  size?: number
}) {
  const dpr = useThree((s) => s.viewport.dpr)
  const material = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const scale = new Float32Array(count)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = center[0] + (Math.random() - 0.5) * area[0]
      pos[i * 3 + 1] = center[1] + (Math.random() - 0.3) * area[1]
      pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * area[2]
      scale[i] = 0.4 + Math.random() * 1.1
      phase[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(dpr, 2) },
      uSize: { value: size },
      uColor: { value: new THREE.Color(color) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((_, dt) => {
    if (!material.current || fx.reduced) return
    material.current.uniforms.uTime.value += dt
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
