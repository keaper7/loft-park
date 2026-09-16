'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useStore as useThreeStore } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, SSAO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ShaderPass, ToneMappingMode, type BloomEffect } from 'postprocessing'
import { useStore } from '@/lib/store'
import { CameraRig } from './CameraRig'
import { Park } from './Park'
import { Pavilion } from './Pavilion'
import { Hall } from './Hall'
import { LanternTrees } from './LanternTrees'
import { LoftSign } from './LoftSign'
import { Gazebo } from './Gazebo'
import { Carousel } from './Carousel'
import { Attractions } from './Attractions'
import { Dishes } from './Dishes'
import { fx } from './fx'

/**
 * Санитар кадра перед bloom. Один пиксель NaN или Infinity (вырожденная
 * нормаль, деление на ноль в шейдере, переполнение half float) mipmap-bloom
 * размазывает по всей цепочке уменьшенных копий — на экране это чёрный
 * квадрат на кадр-другой. Пасс заменяет такие пиксели нулём и срезает
 * отрицательные и запредельные значения, откуда бы они ни пришли.
 * Проверка двойная: isnan на части драйверов вырезается оптимизатором,
 * а сравнение с NaN всегда ложно.
 */
function createSanitizePass() {
  return new ShaderPass(
    new THREE.ShaderMaterial({
      name: 'SanitizeMaterial',
      uniforms: { inputBuffer: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D inputBuffer;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(inputBuffer, vUv).rgb;
          float s = c.r + c.g + c.b;
          bool ok = !isnan(s) && !isinf(s) && s >= 0.0 && s < 1e4;
          gl_FragColor = vec4(ok ? clamp(c, 0.0, 64.0) : vec3(0.0), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  )
}

/**
 * multisampling={0} — не экономия, а обход: MSAA-буфер композера на
 * Metal (Apple M-серии, ANGLE) отдаёт полностью чёрный кадр. Сглаживание
 * даёт повышенный dpr, а bloom и виньетка всё равно размывают края.
 */
function Effects() {
  const bloom = useRef<BloomEffect>(null)
  const sanitize = useMemo(createSanitizePass, [])
  useEffect(() => () => sanitize.dispose(), [sanitize])
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = fx.bloom
  })
  return (
    // enableNormalPass — для SSAO: он читает нормали сцены
    <EffectComposer multisampling={0} enableNormalPass>
      <primitive object={sanitize} dispose={null} />
      {/* Мягкое затенение в углах, стыках и под мебелью. Настоящие карты теней
          от десятка точечных ламп — это по шесть проходов на лампу; SSAO даёт
          главное: интерьер перестаёт выглядеть «вырезанным из бумаги».
          Работает только вблизи (worldDistance), парк и небо не трогает */}
      <SSAO
        samples={16}
        rings={5}
        radius={0.055}
        intensity={1.9}
        bias={0.035}
        luminanceInfluence={0.5}
        resolutionScale={0.5}
        worldDistanceThreshold={26}
        worldDistanceFalloff={6}
        worldProximityThreshold={0.8}
        worldProximityFalloff={0.3}
      />
      <Bloom ref={bloom} mipmapBlur intensity={1} luminanceThreshold={0.95} luminanceSmoothing={0.2} radius={0.75} />
      <Vignette offset={0.25} darkness={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

/** Сообщает прелоадеру, что кадр реально отрисован, а не просто смонтирован */
function ReadySignal() {
  const frames = useRef(0)
  const setReady = useStore((s) => s.setSceneReady)
  useFrame(() => {
    frames.current++
    if (frames.current === 3) setReady()
  })
  return null
}

/**
 * Смена размера холста (поворот экрана, окно, снижение dpr) обнуляет его
 * буфер, и до следующего rAF браузер успевает показать пустой — чёрный —
 * кадр. Дорисовываем сцену сразу, в той же задаче, до отрисовки страницы.
 */
function SeamlessResize() {
  const store = useThreeStore()
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.size === prev.size && s.viewport.dpr === prev.viewport.dpr) return
        queueMicrotask(() => store.getState().advance(performance.now()))
      }),
    [store],
  )
  return null
}

/**
 * Плотность пикселей с бюджетом: на большом ретина-экране dpr 1.75 — это
 * 5+ млн пикселей в half float и цепочка bloom. Видеокарта задыхается, и
 * браузер не успевает растеризовать плитки страницы при скролле. Бюджет
 * держит холст в пределах ~4 млн пикселей, резкость на глаз та же.
 */
function initialDpr(quality: 'high' | 'low') {
  const cap = Math.min(quality === 'high' ? 1.75 : 1.25, window.devicePixelRatio || 1)
  const budget = quality === 'high' ? 4e6 : 1.8e6
  const fit = Math.sqrt(budget / Math.max(1, window.innerWidth * window.innerHeight))
  return Math.max(1, Math.min(cap, fit))
}

export default function Experience({ quality, reduced }: { quality: 'high' | 'low'; reduced: boolean }) {
  const [dpr, setDpr] = useState(() => initialDpr(quality))
  // Отладочные флаги в адресе: ?nofx — без постобработки, ?debug — сцена в window.__loft
  const [flags] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    return { nofx: q.has('nofx'), debug: q.has('debug') }
  })

  useEffect(() => {
    fx.reduced = reduced
  }, [reduced])

  return (
    <Canvas
      dpr={dpr}
      // alpha: false — холст непрозрачный и не смешивается со страницей:
      // пиксели с «потерянной» альфой в bloom не просвечивают чёрным фоном body
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }}
      // near 0.25, а не 0.1: точность глубины вдали вырастает вдвое с лишним,
      // плоскости плитки и световых пятен у земли перестают мерцать
      camera={{ fov: 55, near: 0.25, far: 420, position: [0, 2.2, 16] }}
      onCreated={(state) => {
        if (flags.debug) (window as unknown as { __loft: unknown }).__loft = { state, fx, THREE }
      }}
    >
      <color attach="background" args={['#07090d']} />
      <fogExp2 attach="fog" args={['#0b1016', 0.035]} />
      {/* Только вниз и один раз: смена dpr пересоздаёт буфер холста, и каждое
          «снизить — вернуть» было видно как моргание всей сцены */}
      <PerformanceMonitor flipflops={1} onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} />

      <hemisphereLight args={['#4a6194', '#140d08', 0.95]} />
      <ambientLight intensity={0.2} color="#ffdcb0" />
      <directionalLight position={[-40, 60, -80]} intensity={0.35} color="#9fb4ff" />

      <SeamlessResize />
      <CameraRig />
      <Park quality={quality} />
      <LoftSign />
      <Pavilion quality={quality} />
      <LanternTrees quality={quality} />
      <Hall />
      <Gazebo />
      <Carousel />
      <Attractions quality={quality} />
      <Dishes />
      <ReadySignal />
      {!flags.nofx && <Effects />}
    </Canvas>
  )
}
