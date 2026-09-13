'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'
import { TREES } from './layout'

/**
 * Старые деревья Loft Park: стволы обмотаны тёплыми гирляндами, с нижних
 * веток свисают фонарики-«клетки» с лампой внутри. Это то, что видно
 * с аллеи раньше, чем само здание.
 *
 * Всё инстансами: стволы и ветки — один меш, кроны — один, у фонариков
 * по мешу на провод, каркас, крышку и лампу; гирлянды — одни Points
 * с мерцанием в шейдере. Шесть деревьев стоят ~8 draw calls.
 */

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const fairyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aPhase;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 26.0 * uPixelRatio / -mv.z;
    vA = 0.55 + 0.45 * sin(uTime * 2.3 + aPhase * 50.0);
  }
`
const fairyFragment = /* glsl */ `
  varying float vA;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float g = 0.06 / d - 0.12;
    if (g <= 0.0) discard;
    gl_FragColor = vec4(vec3(2.6, 1.9, 1.0), g * vA);
  }
`

type Lantern = { ax: number; ay: number; az: number; len: number; phase: number }

export function LanternTrees({ quality }: { quality: 'high' | 'low' }) {
  const wood = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const wires = useRef<THREE.InstancedMesh>(null)
  const cages = useRef<THREE.InstancedMesh>(null)
  const caps = useRef<THREE.InstancedMesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const fairyMat = useRef<THREE.ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)

  const data = useMemo(() => {
    const r = seeded(77)
    const woodM: THREE.Matrix4[] = []
    const crownM: THREE.Matrix4[] = []
    const crownC: THREE.Color[] = []
    const lanterns: Lantern[] = []
    const fairy: number[] = []
    const phases: number[] = []
    const up = new THREE.Vector3(0, 1, 0)

    const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number) => {
      const mid = from.clone().addScaledVector(dir, len / 2)
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir)
      woodM.push(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(rad, len, rad)))
      // гирлянда вдоль ветки
      const n = Math.round(len * (quality === 'high' ? 26 : 14))
      for (let i = 0; i < n; i++) {
        const p = from.clone().addScaledVector(dir, (i / n) * len)
        const a = i * 1.9
        fairy.push(p.x + Math.cos(a) * rad * 1.1, p.y, p.z + Math.sin(a) * rad * 1.1)
        phases.push(r())
      }
      return from.clone().addScaledVector(dir, len)
    }

    TREES.forEach((t) => {
      const base = new THREE.Vector3(t.x, 0, t.z)
      const top = branch(base, up.clone(), t.h, 0.24 * t.s)
      // ствол плотнее обмотан гирляндой — спираль
      const loops = quality === 'high' ? 240 : 120
      for (let i = 0; i < loops; i++) {
        const y = 0.25 + (i / loops) * (t.h - 0.3)
        const a = i * 0.55
        fairy.push(t.x + Math.cos(a) * 0.27 * t.s, y, t.z + Math.sin(a) * 0.27 * t.s)
        phases.push(r())
      }
      const ends: THREE.Vector3[] = []
      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + r()
        const dir = new THREE.Vector3(Math.cos(ang) * 0.8, 0.9 + r() * 0.5, Math.sin(ang) * 0.8).normalize()
        const start = new THREE.Vector3(t.x, t.h * (0.7 + r() * 0.25), t.z)
        ends.push(branch(start, dir, (1.8 + r() * 1.2) * t.s, 0.1 * t.s))
      }
      ends.push(top)
      // крона: облака из сфер вокруг концов веток
      ends.forEach((e) => {
        for (let k = 0; k < 3; k++) {
          const p = e.clone().add(new THREE.Vector3((r() - 0.5) * 2.2, 0.6 + r() * 1.2, (r() - 0.5) * 2.2).multiplyScalar(t.s))
          const sc = (1.3 + r() * 0.9) * t.s
          crownM.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.8, sc)))
          crownC.push(new THREE.Color().setHSL(0.24 + r() * 0.07, 0.4 + r() * 0.15, 0.13 + r() * 0.08))
        }
      })
      // фонарики свисают с нижнего яруса веток
      for (let l = 0; l < t.lanterns; l++) {
        const ang = r() * Math.PI * 2
        // не дальше ~2 м от ствола: над террасой фонари висят в проёме маркиз
        const rad = (0.5 + r() * 1.1) * t.s
        // точка подвеса — под кроной, чтобы фонари висели в поле зрения, а не в листве
        const ay = t.h - 0.3 + r() * 0.8
        lanterns.push({ ax: t.x + Math.cos(ang) * rad, ay, az: t.z + Math.sin(ang) * rad, len: 0.3 + r() * 0.9, phase: r() * 6 })
      }
    })

    const fairyGeo = new THREE.BufferGeometry()
    fairyGeo.setAttribute('position', new THREE.Float32BufferAttribute(fairy, 3))
    fairyGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
    return { woodM, crownM, crownC, lanterns, fairyGeo }
  }, [quality])

  useLayoutEffect(() => {
    data.woodM.forEach((m, i) => wood.current?.setMatrixAt(i, m))
    data.crownM.forEach((m, i) => {
      crowns.current?.setMatrixAt(i, m)
      crowns.current?.setColorAt(i, data.crownC[i])
    })
    if (wood.current) wood.current.instanceMatrix.needsUpdate = true
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
    }
  }, [data])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const t = fx.reduced ? 0 : clock.elapsedTime
    if (fairyMat.current) fairyMat.current.uniforms.uTime.value = t
    data.lanterns.forEach((l, i) => {
      // лёгкое покачивание на ветру: фонарь — маятник на проводе
      const sx = Math.sin(t * 0.9 + l.phase) * 0.06
      const sz = Math.cos(t * 0.7 + l.phase * 1.3) * 0.05
      e.set(sx, 0, sz)
      q.setFromEuler(e)
      const down = v.set(0, -l.len, 0).applyQuaternion(q)
      const bx = l.ax + down.x
      const by = l.ay + down.y
      const bz = l.az + down.z
      m.compose(v.set(l.ax + down.x / 2, l.ay + down.y / 2, l.az + down.z / 2), q, v.clone().set(1, l.len, 1))
      wires.current?.setMatrixAt(i, m)
      m.compose(v.set(bx, by - 0.27, bz), q, one)
      cages.current?.setMatrixAt(i, m)
      bulbs.current?.setMatrixAt(i, m)
      m.compose(v.set(bx, by - 0.01, bz), q, one)
      caps.current?.setMatrixAt(i, m)
    })
    ;[wires, cages, bulbs, caps].forEach((r) => r.current && (r.current.instanceMatrix.needsUpdate = true))
  })

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: Math.min(dpr, 2) } }), [dpr])
  const n = data.lanterns.length

  return (
    <group>
      <instancedMesh ref={wood} args={[undefined, undefined, data.woodM.length]}>
        <cylinderGeometry args={[0.75, 1, 1, 8]} />
        <meshStandardMaterial color="#3a2d24" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, data.crownM.length]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>

      <instancedMesh ref={wires} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[0.006, 0.006, 1, 3]} />
        <meshBasicMaterial color="#1a1612" />
      </instancedMesh>
      <instancedMesh ref={cages} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.23, 0.5, 6, 3, true]} />
        <meshBasicMaterial color={[1.9, 1.35, 0.6]} wireframe toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, n]} frustumCulled={false}>
        <coneGeometry args={[0.25, 0.18, 6]} />
        <meshStandardMaterial color="#c79a4a" metalness={0.7} roughness={0.35} emissive="#5a3a10" />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, n]} frustumCulled={false}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshBasicMaterial color={[8, 5, 2]} toneMapped={false} />
      </instancedMesh>

      <points geometry={data.fairyGeo} frustumCulled={false}>
        <shaderMaterial
          ref={fairyMat}
          vertexShader={fairyVertex}
          fragmentShader={fairyFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* тёплый свет фонариков на плитке и настиле — по одному на два дерева */}
      {TREES.filter((_, i) => i % 2 === 0).map((t) => (
        <pointLight key={`${t.x}${t.z}`} position={[t.x, t.h - 0.2, t.z]} color="#ffb46a" intensity={9} distance={11} decay={1.5} />
      ))}
    </group>
  )
}
