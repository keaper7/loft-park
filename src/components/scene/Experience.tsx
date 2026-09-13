'use client'

import { useEffect, useRef, useState } from 'react'
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
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 420, position: [0, 2.1, 12] }}
      onCreated={(state) => {
        if (flags.debug) (window as unknown as { __loft: unknown }).__loft = { state, fx }
      }}
    >
      <color attach="background" args={['#07090d']} />
      <fogExp2 attach="fog" args={['#0b1016', 0.035]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(quality === 'high' ? 1.75 : 1.25)} />

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
      <Dishes />
      <ReadySignal />
      {!flags.nofx && <Effects />}
    </Canvas>
  )
}
