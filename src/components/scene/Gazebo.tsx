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
      // Фасад шатра — две шторы по краям, а не одно полотно во всю ширину:
      // сплошное закрывало весь шатёр серой пеленой в кадре 9, который как раз
      // на шатёр и смотрит. Посередине остаётся открытый проход
      { pos: [G.x0 + 1.4, G.h / 2, G.zNear], rotY: Math.PI, width: 2.6 },
      { pos: [G.x1 - 1.4, G.h / 2, G.zNear], rotY: Math.PI, width: 2.6 },
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
    // Цветы свисают гирляндой с балок по периметру и с центральной балки —
    // как на фото. Равномерное облако по всему объёму читалось конфетти,
    // висящим в воздухе посреди шатра
    for (let i = 0; i < 560; i++) {
      const t = r()
      const side = Math.floor(r() * 5)
      let x: number
      let z: number
      if (side === 0 || side === 1) {
        // вдоль передней и задней балок
        x = G.x0 + 0.5 + t * (w - 1)
        z = side === 0 ? G.zNear - 0.3 : G.zFar + 0.3
      } else if (side === 2 || side === 3) {
        // вдоль боковых балок
        x = side === 2 ? G.x0 + 0.3 : G.x1 - 0.3
        z = G.zFar + 0.5 + t * (d - 1)
      } else {
        // центральная балка поперёк шатра
        x = G.x0 + 0.5 + t * (w - 1)
        z = cz
      }
      const s = 0.028 + r() * 0.04
      // приплюснутый комок вместо шара: шар на таком размере читается бусиной
      items.push(mat([x + (r() - 0.5) * 0.45, G.h - 0.08 - Math.pow(r(), 1.8) * 0.85, z + (r() - 0.5) * 0.45], [s, s * 0.7, s], r() * 3, r() * 3))
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
        {/* настил чуть светлее прежнего: на почти чёрном полу мебель шатра
            не на чем было «поставить» — она читалась парящей */}
        <meshStandardMaterial color="#453121" roughness={0.9} />
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
        {/* Крыша шатра светится изнутри. Плотностью тут не помочь: сверху на
            неё падает только холодный свет неба (#4a6194) и луны, поэтому
            тёплый беж отрисовывался синевато-серым — стеклянной крышей
            бассейна. Собственное тёплое свечение — это то, как шатёр выглядит
            ночью на фото: лампы под крышей просвечивают сквозь ткань.
            0.42 × #a8763a даёт ~0.28 яркости — ниже порога bloom (0.95),
            так что крыша не превращается в светящееся пятно.
            Кадр 9.3 лежит на пути камеры 9 → 10 — этот ракурс видит и гость */}
        <meshStandardMaterial
          color="#e6d9c2"
          emissive="#a8763a"
          emissiveIntensity={0.42}
          transparent
          opacity={0.96}
          roughness={1}
          side={THREE.DoubleSide}
        />
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

      {/* Длинный стол с лавками в ближней половине шатра. Вся мебель стояла в
          дальней половине, и кадр 9 — тот, что смотрит в шатёр, — упирался в
          пустой настил. Под шатром как раз и сидят большой компанией */}
      <group position={[cx, 0.16, G.zNear - 3.2]}>
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[0.95, 0.06, 2.8]} />
          <meshStandardMaterial color="#8a6038" roughness={0.6} />
        </mesh>
        {[-1.2, 1.2].map((dz) => (
          <mesh key={dz} position={[0, 0.37, dz]}>
            <boxGeometry args={[0.75, 0.72, 0.08]} />
            {/* Опоры тёплого дерева, а не чёрная сталь: на тёмном настиле
                ночью чёрные ножки пропадают, и столешница с лавками висят
                в воздухе досками */}
            <meshStandardMaterial color="#6b4a2c" roughness={0.7} />
          </mesh>
        ))}
        {[-1.15, 1.15].map((dx) => (
          <group key={dx} position={[dx, 0, 0]}>
            <mesh position={[0, 0.44, 0]}>
              <boxGeometry args={[0.38, 0.08, 2.4]} />
              <meshStandardMaterial color="#8a6038" roughness={0.7} />
            </mesh>
            {[-0.9, 0.9].map((dz) => (
              <mesh key={dz} position={[0, 0.2, dz]}>
                <boxGeometry args={[0.32, 0.4, 0.06]} />
                <meshStandardMaterial color="#6b4a2c" roughness={0.7} />
              </mesh>
            ))}
          </group>
        ))}
        {[-0.9, 0, 0.9].map((dz) => (
          <group key={dz} position={[0, 0.83, dz]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.1, 10]} />
              <meshStandardMaterial color="#efe6d2" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <sphereGeometry args={[0.016, 8, 6]} />
              <meshBasicMaterial color={[6, 3.4, 1.3]} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

      {/* кадки с зеленью по углам у входа в шатёр */}
      {[G.x0 + 0.9, G.x1 - 0.9].map((x) => (
        <group key={x} position={[x, 0.16, G.zNear - 0.9]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#2b2722" roughness={0.85} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh
              key={k}
              geometry={bloomGeo}
              position={[Math.cos(k * 1.7) * 0.18, 0.75 + k * 0.17, Math.sin(k * 1.7) * 0.18]}
              scale={[0.3, 0.22, 0.3]}
            >
              <meshStandardMaterial color="#3f7d33" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* «облако» цветов и зелени под крышей и лампочки в нём */}
      <Instances items={blooms.items} geometry={bloomGeo} material={bloomMat} colors={blooms.colors} />
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[G.x0 + 1 + ((i * 2.9) % (w - 2)), G.h - 0.55 - (i % 3) * 0.12, G.zFar + 1 + ((i * 4.3) % (d - 2))]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshBasicMaterial color={[6, 3.6, 1.4]} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[cx, G.h - 0.8, cz]} color="#ffb46a" intensity={10} distance={10} decay={1.5} />
      {/* вторая лампа над новым столом: единственная висела над центром
          шатра, и ближняя половина — та, в которую смотрит кадр 9, — тонула */}
      <pointLight position={[cx, G.h - 0.9, G.zNear - 3.2]} color="#ffb46a" intensity={8} distance={8} decay={1.5} />
    </group>
  )
}
