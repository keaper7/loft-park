'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fx } from './fx'
import { TREES } from './layout'
import { concreteTexture } from './textures'
import { crownGeometry, foliageMaterial } from './foliage'

/**
 * Старые деревья Loft Park — то, что видно с аллеи раньше самого здания.
 * По фото гостей:
 * - ствол и главные ветви плотно, до самой кроны, обмотаны тёплыми
 *   гирляндами — ночью дерево светится как колонна;
 * - на ветках высоко висят белые фонари-«марокканцы»: шестигранный
 *   корпус из светящегося контура, шатровая крыша с колечком;
 * - деревья на террасе растут из больших бетонных кашпо, у основания —
 *   россыпь огоньков.
 *
 * Всё инстансами: ветки — один меш, кроны — один, у фонарей по мешу на
 * провод, контур и свечение; гирлянды — одни Points с мерцанием в шейдере.
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
    // Не меньше двух пикселей: с площади огоньки в 1 px терялись, и обмотанный
    // гирляндой ствол не светился колонной, как на фото. Не больше 40 px вблизи.
    gl_PointSize = clamp(52.0 * uPixelRatio / max(-mv.z, 0.2), 2.2 * uPixelRatio, 40.0 * uPixelRatio);
    // вдали точки не тонут в тумане (своего тумана у них нет) — гасим вручную
    float far = clamp(1.0 - (-mv.z - 35.0) / 90.0, 0.3, 1.0);
    vA = (0.6 + 0.4 * sin(uTime * 2.3 + aPhase * 50.0)) * far;
  }
`
const fairyFragment = /* glsl */ `
  varying float vA;
  void main() {
    // защита от деления на ноль: иначе NaN → чёрные квадраты в bloom (см. Fireflies)
    float d = max(distance(gl_PointCoord, vec2(0.5)), 0.02);
    float g = min(0.06 / d - 0.12, 2.0);
    if (g <= 0.0) discard;
    // тёплый янтарь гирлянды: белее — и в bloom стволы выглядели холодным кораллом
    gl_FragColor = vec4(vec3(2.5, 1.7, 0.8), clamp(g * vA, 0.0, 1.0));
  }
`

const L_H = 0.46
const L_TOP = 0.17
const L_BOTTOM = 0.12
/** От центра фонаря до колечка на крыше */
const L_HANG = L_H / 2 + 0.27

/** Контур фонаря: шесть рёбер, три кольца, шатёр с колечком, донце */
function lanternGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r = 0.011) => {
    const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 4, 1)
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize())
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)))
    parts.push(g)
  }
  const at = (k: number, rad: number, y: number) => new THREE.Vector3(Math.cos((k / 6) * Math.PI * 2) * rad, y, Math.sin((k / 6) * Math.PI * 2) * rad)
  const top = L_H / 2
  const bottom = -L_H / 2
  const mid = (L_TOP + L_BOTTOM) / 2
  for (let k = 0; k < 6; k++) {
    rod(at(k, L_BOTTOM, bottom), at(k, L_TOP, top))
    rod(at(k, L_BOTTOM, bottom), at(k + 1, L_BOTTOM, bottom))
    rod(at(k, L_TOP, top), at(k + 1, L_TOP, top))
    rod(at(k, mid, 0), at(k + 1, mid, 0), 0.008)
    rod(at(k, L_TOP, top), new THREE.Vector3(0, top + 0.2, 0))
    rod(at(k, L_BOTTOM, bottom), new THREE.Vector3(0, bottom - 0.08, 0), 0.008)
  }
  const loop = new THREE.TorusGeometry(0.035, 0.009, 4, 10)
  loop.translate(0, top + 0.24, 0)
  parts.push(loop)
  return mergeGeometries(parts)!
}

type Lantern = { ax: number; ay: number; az: number; len: number; phase: number }

export function LanternTrees({ quality }: { quality: 'high' | 'low' }) {
  const wood = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const wires = useRef<THREE.InstancedMesh>(null)
  const frames = useRef<THREE.InstancedMesh>(null)
  const glows = useRef<THREE.InstancedMesh>(null)
  const fairyMat = useRef<THREE.ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const lanternGeo = useMemo(() => lanternGeometry(), [])
  const concrete = useMemo(() => concreteTexture(), [])
  const crownGeo = useMemo(() => crownGeometry(13, 3, 2), [])
  // слабое свечение: ночью листва подсвечена гирляндами снизу
  const crownMat = useMemo(() => foliageMaterial({ emissive: '#1a2a0c', emissiveIntensity: 0.7 }), [])

  const data = useMemo(() => {
    const r = seeded(77)
    const high = quality === 'high'
    const woodM: THREE.Matrix4[] = []
    const crownM: THREE.Matrix4[] = []
    const crownC: THREE.Color[] = []
    const lanterns: Lantern[] = []
    const fairy: number[] = []
    const phases: number[] = []
    const up = new THREE.Vector3(0, 1, 0)
    const dot = (x: number, y: number, z: number) => {
      fairy.push(x, y, z)
      phases.push(r())
    }

    /** Ветка-цилиндр, вдоль неё — спираль гирлянды */
    const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, lit: boolean) => {
      const mid = from.clone().addScaledVector(dir, len / 2)
      woodM.push(new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(up, dir), new THREE.Vector3(rad, len, rad)))
      if (lit) {
        // перпендикуляры к ветке — для витков
        const side = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize()
        const side2 = new THREE.Vector3().crossVectors(dir, side)
        const n = Math.round(len * (high ? 44 : 24))
        for (let i = 0; i < n; i++) {
          const a = i * 1.1
          const p = from.clone().addScaledVector(dir, (i / n) * len)
          p.addScaledVector(side, Math.cos(a) * rad * 1.15).addScaledVector(side2, Math.sin(a) * rad * 1.15)
          dot(p.x, p.y, p.z)
        }
      }
      return from.clone().addScaledVector(dir, len)
    }

    TREES.forEach((t) => {
      const base = new THREE.Vector3(t.x, 0, t.z)
      const trunkR = 0.26 * t.s
      const top = branch(base, up.clone(), t.h, trunkR, false)
      // ствол: плотная спираль огоньков до развилки
      const loops = high ? 900 : 420
      const lit = t.h * 0.62
      for (let i = 0; i < loops; i++) {
        const y = 0.3 + (i / loops) * lit
        const a = i * 0.47
        dot(t.x + Math.cos(a) * trunkR * 1.08, y, t.z + Math.sin(a) * trunkR * 1.08)
      }
      // огоньки в кашпо у основания
      if (t.planter) {
        for (let i = 0; i < (high ? 70 : 30); i++) {
          const a = r() * Math.PI * 2
          const d = 0.35 + r() * 0.35
          dot(t.x + Math.cos(a) * d, 0.8, t.z + Math.sin(a) * d)
        }
      }

      const ends: THREE.Vector3[] = [top]
      const forks = 5
      for (let b = 0; b < forks; b++) {
        const ang = (b / forks) * Math.PI * 2 + r() * 0.8
        const dir = new THREE.Vector3(Math.cos(ang) * 0.75, 0.75 + r() * 0.45, Math.sin(ang) * 0.75).normalize()
        const start = new THREE.Vector3(t.x, t.h * (0.5 + r() * 0.18), t.z)
        const end = branch(start, dir, (2.3 + r() * 1.1) * t.s, 0.12 * t.s, true)
        ends.push(end)
        for (let c = 0; c < 2; c++) {
          const a2 = ang + (c ? 0.7 : -0.7) + (r() - 0.5) * 0.4
          const d2 = new THREE.Vector3(Math.cos(a2) * 0.7, 0.8 + r() * 0.4, Math.sin(a2) * 0.7).normalize()
          ends.push(branch(end, d2, (1.2 + r() * 0.8) * t.s, 0.06 * t.s, high || c === 0))
        }
      }
      // крона: облака из сфер вокруг концов веток
      ends.forEach((e) => {
        for (let k = 0; k < 2; k++) {
          const p = e.clone().add(new THREE.Vector3((r() - 0.5) * 1.8, 0.4 + r() * 1.1, (r() - 0.5) * 1.8).multiplyScalar(t.s))
          const sc = (1.2 + r() * 0.9) * t.s
          crownM.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.8, sc)))
          crownC.push(new THREE.Color().setHSL(0.25 + r() * 0.06, 0.42 + r() * 0.15, 0.15 + r() * 0.08))
        }
      })

      // Фонари. На террасе треть висит низко в проёме маркиз, прямо над
      // гостями; остальные — высоко в ветвях, как видно с площади.
      for (let l = 0; l < t.lanterns; l++) {
        const low = t.planter && l % 3 === 0
        const ang = r() * Math.PI * 2
        const rad = low ? 0.55 + r() * 0.5 : (0.9 + r() * 1.8) * t.s
        const center = low ? 2.85 + r() * 0.35 : 4.1 + r() * 2.4
        const ay = low ? 4.3 + r() * 0.6 : center + L_HANG + 0.3 + r() * 0.9
        lanterns.push({ ax: t.x + Math.cos(ang) * rad, ay, az: t.z + Math.sin(ang) * rad, len: ay - center - L_HANG, phase: r() * 6 })
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
  const s = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const time = fx.reduced ? 0 : clock.elapsedTime
    if (fairyMat.current) fairyMat.current.uniforms.uTime.value = time
    data.lanterns.forEach((l, i) => {
      // лёгкое покачивание на ветру: фонарь — маятник на проводе
      e.set(Math.sin(time * 0.9 + l.phase) * 0.05, 0, Math.cos(time * 0.7 + l.phase * 1.3) * 0.045)
      q.setFromEuler(e)
      // куда поворот уводит низ провода: (0, −1, 0) под углами e.x и e.z
      const dx = Math.sin(e.z)
      const dz = -Math.sin(e.x)
      // провод: от точки подвеса вниз на len
      m.compose(v.set(l.ax + (dx * l.len) / 2, l.ay - l.len / 2, l.az + (dz * l.len) / 2), q, s.set(1, l.len, 1))
      wires.current?.setMatrixAt(i, m)
      const reach = l.len + L_HANG
      m.compose(v.set(l.ax + dx * reach, l.ay - reach, l.az + dz * reach), q, one)
      frames.current?.setMatrixAt(i, m)
      glows.current?.setMatrixAt(i, m)
    })
    ;[wires, frames, glows].forEach((ref) => ref.current && (ref.current.instanceMatrix.needsUpdate = true))
  })

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: Math.min(dpr, 2) } }), [dpr])
  const n = data.lanterns.length
  const planters = TREES.filter((t) => t.planter)

  return (
    <group>
      <instancedMesh ref={wood} args={[undefined, undefined, data.woodM.length]}>
        <cylinderGeometry args={[0.75, 1, 1, 8]} />
        {/* тёплый отсвет: кора под сплошной гирляндой не бывает чёрной */}
        <meshStandardMaterial color="#3a2d24" roughness={1} emissive="#5a3a14" emissiveIntensity={0.55} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[crownGeo, crownMat, data.crownM.length]} />

      {/* бетонные кашпо, из которых растут деревья террасы */}
      {planters.map((t) => (
        <group key={`${t.x}${t.z}`} position={[t.x, 0, t.z]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.5, 0.84, 1.5]} />
            <meshStandardMaterial map={concrete} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.79, 0]}>
            <boxGeometry args={[1.3, 0.04, 1.3]} />
            <meshStandardMaterial color="#d8d2c6" roughness={1} />
          </mesh>
        </group>
      ))}

      <instancedMesh ref={wires} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[0.006, 0.006, 1, 3]} />
        <meshBasicMaterial color="#1a1612" />
      </instancedMesh>
      <instancedMesh ref={frames} args={[lanternGeo, undefined, n]} frustumCulled={false}>
        <meshBasicMaterial color={[2.6, 2.2, 1.45]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[L_TOP * 0.92, L_BOTTOM * 0.92, L_H, 6]} />
        <meshBasicMaterial color={[1.3, 0.95, 0.5]} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
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

      {/* тёплый свет гирлянд на плитке и настиле — у трёх деревьев */}
      {[TREES[0], TREES[1], TREES[3]].map((t) => (
        <pointLight key={`${t.x}${t.z}`} position={[t.x, 2.9, t.z]} color="#ffb46a" intensity={9} distance={11} decay={1.5} />
      ))}
    </group>
  )
}
