'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type BloomEffect } from 'postprocessing'
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
 * multisampling={0} — не экономия, а обход: MSAA-буфер композера на
 * Metal (Apple M-серии, ANGLE) отдаёт полностью чёрный кадр. Сглаживание
 * даёт повышенный dpr, а bloom и виньетка всё равно размывают края.
 */
function Effects() {
  const bloom = useRef<BloomEffect>(null)
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = fx.bloom
  })
  return (
    <EffectComposer multisampling={0}>
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

export default function Experience({ quality, reduced }: { quality: 'high' | 'low'; reduced: boolean }) {
  const [dpr, setDpr] = useState(quality === 'high' ? 1.75 : 1.25)
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
