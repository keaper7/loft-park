'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { KEYFRAMES } from './keyframes'
import { fx, smooth } from './fx'

/**
 * Камера едет между ключевыми кадрами по значению scrollState.cam.
 *
 * Внутри отрезка — smoothstep: у каждого кадра камера «оседает», как
 * на операторской тележке, а не проскакивает мимо. Поверх — сглаживание
 * по времени (damp), оно гасит рывки колеса, и лёгкий параллакс от курсора,
 * который затухает на крупных планах блюд, чтобы не трясти композицию.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const scene = useThree((s) => s.scene)

  const colors = useMemo(() => KEYFRAMES.map((k) => new THREE.Color(k.fogColor)), [])
  const target = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3(...KEYFRAMES[0].look))
  const lookTarget = useRef(new THREE.Vector3())
  const tmpA = useRef(new THREE.Vector3())
  const tmpB = useRef(new THREE.Vector3())
  const color = useRef(new THREE.Color())
  const first = useRef(true)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const last = KEYFRAMES.length - 1
    const c = THREE.MathUtils.clamp(scrollState.cam, 0, last)
    const i = Math.min(Math.floor(c), last - 1)
    const t = smooth(THREE.MathUtils.clamp(c - i, 0, 1))
    const a = KEYFRAMES[i]
    const b = KEYFRAMES[i + 1]

    target.current.lerpVectors(tmpA.current.set(...a.pos), tmpB.current.set(...b.pos), t)
    lookTarget.current.lerpVectors(tmpA.current.set(...a.look), tmpB.current.set(...b.look), t)

    // Параллакс: сильнее в парке и на общем виде, почти нет на блюдах
    const closeUp = 1 - Math.min(1, Math.abs(c - 5) / 1.6)
    const amount = fx.reduced ? 0 : 0.45 * (1 - closeUp * 0.85)
    target.current.x += scrollState.mouseX * amount
    target.current.y -= scrollState.mouseY * amount * 0.5

    const k = first.current || fx.reduced || fx.snap ? 1 : 1 - Math.exp(-3.2 * dt)
    first.current = false
    camera.position.lerp(target.current, k)
    look.current.lerp(lookTarget.current, k)
    camera.lookAt(look.current)

    const fov = THREE.MathUtils.lerp(a.fov, b.fov, t)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * k
      camera.updateProjectionMatrix()
    }

    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) {
      fog.density = THREE.MathUtils.lerp(a.fog, b.fog, t)
      color.current.lerpColors(colors[i], colors[i + 1], t)
      fog.color.copy(color.current)
      if (scene.background instanceof THREE.Color) scene.background.copy(color.current).multiplyScalar(0.7)
    }

    fx.cam = c
    fx.bloom = THREE.MathUtils.lerp(a.bloom, b.bloom, t)
  })

  return null
}
