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
function Effects({ quality }: { quality: 'high' | 'low' }) {
  const bloom = useRef<BloomEffect>(null)
  const sanitize = useMemo(createSanitizePass, [])
  useEffect(() => () => sanitize.dispose(), [sanitize])
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = fx.bloom
  })
  /**
   * SSAO — только на десктопе.
   *
   * Он требует enableNormalPass, а это ОТДЕЛЬНЫЙ полный проход отрисовки
   * сцены в буфер нормалей — фактически вторая отрисовка каждого кадра.
   * Замер с удушением процессора (эмуляция слабого телефона): с полной
   * постобработкой 4× давало 44.9 кадра и 147 кадров длиннее 33 мс, 6× —
   * 30 кадров, 334 тяжёлых, и сторож ронял холст с 750×1624 до 525×1136.
   * Без постобработки те же прогоны: 55 и 40.5 кадра, 43 и 201 тяжёлый,
   * и холст оставался 2.0. То есть эффекты отнимали и плавность, и
   * чёткость разом. Bloom оставляем — на нём держится весь вечерний свет;
   * мягкие тени в углах на экране шириной 375 точек всё равно не читаются.
   */
  const ao = quality === 'high'
  return (
    <EffectComposer multisampling={0} enableNormalPass={ao}>
      <primitive object={sanitize} dispose={null} />
      {/* Мягкое затенение в углах, стыках и под мебелью. Настоящие карты теней
          от десятка точечных ламп — это по шесть проходов на лампу; SSAO даёт
          главное: интерьер перестаёт выглядеть «вырезанным из бумаги».
          Работает только вблизи (worldDistance), парк и небо не трогает */}
      {ao ? (
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
      ) : null}
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
 * держит холст в разумных пределах, резкость на глаз та же.
 *
 * Потолок для телефонов — 2, а не 1.25. При 1.25 на экране с плотностью 3
 * сцена рисовалась в 468×1015 (0.48 млн пикселей) и растягивалась на
 * 1125×2436 (2.74 млн): каждый нарисованный пиксель размазывался почти на
 * шесть экранных. Рядом с текстом страницы, который рисуется в полном
 * разрешении, это читалось как «мыло и пиксели». С 2 растяжение падает
 * с 2.4 до 1.5.
 *
 * Почему не 3, хотя замер давал 60 кадров и на нём: мерил headless-браузер
 * на видеокарте Mac, а не телефон. Замер доказывает, что 1.25 — слишком
 * мало, но не доказывает, что 3 потянет реальный айфон под нагревом.
 */
function initialDpr(quality: 'high' | 'low') {
  const cap = Math.min(quality === 'high' ? 1.75 : 2, window.devicePixelRatio || 1)
  const budget = quality === 'high' ? 4e6 : 2.4e6
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

  /**
   * Сторож производительности включается не сразу.
   *
   * Первые секунды после шторки — компиляция шейдеров, генерация процедурных
   * текстур и первые кадры постобработки. Это всегда выглядит как просадка,
   * и сторож ронял плотность пикселей насовсем: замер показал холст 525×1136
   * вместо 750×1624, то есть приговор выносился по самому тяжёлому моменту
   * жизни сцены и больше не пересматривался. При этом на ровном ходу сцена
   * держит 60 кадров на любой плотности вплоть до 3.
   *
   * Ждём конца шторки и ещё 2.5 с прогрева: слабые устройства он по-прежнему
   * разгрузит, но нормальные перестанут расплачиваться за старт.
   */
  const introDone = useStore((s) => s.introDone)
  const [watchPerf, setWatchPerf] = useState(false)
  useEffect(() => {
    if (!introDone) return
    const t = setTimeout(() => setWatchPerf(true), 2500)
    return () => clearTimeout(t)
  }, [introDone])

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
          «снизить — вернуть» было видно как моргание всей сцены.
          Ступенька до 1.7 — не до 1 и не до 1.4. При падении в 1 телефон,
          у которого разок дрогнула производительность, до конца сессии
          показывал картинку хуже исходной — та самая мыльность, из-за
          которой подняли потолок в initialDpr. Но и 1.4 оказался немногим
          лучше: замер с удушением процессора в 6× (эмуляция слабого
          устройства) дал холст 525×1136 против экранных 1125×2436, то есть
          растяжение 2.14 — на телефоне это видно глазом. При 1.7 холст
          637×1380, растяжение 1.76, а пикселей всё равно на 28% меньше,
          чем при 2: разгрузка сохраняется, а картинка не разваливается.

          Только onDecline и без flipflops. Раньше здесь стояло flipflops={1}
          и тот же обработчик на onFallback — из-за этого холст падал на
          совершенно здоровой сцене. В drei счётчик flipped растёт и на
          incline: при честных 60 кадрах каждый круг из 10 замеров даёт
          incline (bounds для 60 Гц — [40, 60], а значение >= 60 считается
          ростом), два круга по 2.5 с — и flipped перевалил за 1, сработал
          onFallback. Замер показал: холст падал с 750×1624 до 525×1136
          ровно на 12-й секунде и вхолостую, и при прокрутке, и с ?nofx,
          при неизменных 60 кадрах — то есть по таймеру, а не по нагрузке.
          onFallback в drei значит «хватит подстраиваться», а не «устройство
          не тянет». Снижение теперь только по onDecline: это 8 кругов из 10
          ниже 40 кадров, то есть сцена действительно не идёт */}
      {watchPerf && <PerformanceMonitor onDecline={() => setDpr((d) => Math.min(d, 1.7))} />}

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
      {!flags.nofx && <Effects quality={quality} />}
    </Canvas>
  )
}
