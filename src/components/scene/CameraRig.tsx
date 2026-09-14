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
  const tmpP = useRef(new THREE.Vector3())
  const color = useRef(new THREE.Color())
  const first = useRef(true)
  // ?cam=3.5 — камера замирает в этой точке маршрута: скриншоты кадров без скролла
  const pinned = useMemo(() => {
    const v = new URLSearchParams(window.location.search).get('cam')
    return v === null || Number.isNaN(Number(v)) ? null : Number(v)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const last = KEYFRAMES.length - 1
    // window.__loftCam — то же, что ?cam, но меняется на лету (скрипты проверки кадров)
    const live = (window as unknown as { __loftCam?: number }).__loftCam
    const c = THREE.MathUtils.clamp(live ?? pinned ?? scrollState.cam, 0, last)
    const i = Math.min(Math.floor(c), last - 1)
    const t = smooth(THREE.MathUtils.clamp(c - i, 0, 1))
    const a = KEYFRAMES[i]
    const b = KEYFRAMES[i + 1]

    // 0 — экран шире 1.3:1, 1 — телефон в портрете (≈ 0.45:1)
    const portrait = THREE.MathUtils.clamp((1.3 - camera.aspect) / 0.85, 0, 1)
    const A = tmpA.current.set(...a.pos)
    const B = tmpB.current.set(...b.pos)
    if (portrait > 0 && a.portrait) A.lerp(tmpP.current.set(...a.portrait.pos), portrait)
    if (portrait > 0 && b.portrait) B.lerp(tmpP.current.set(...b.portrait.pos), portrait)
    target.current.lerpVectors(A, B, t)
    A.set(...a.look)
    B.set(...b.look)
    if (portrait > 0 && a.portrait) A.lerp(tmpP.current.set(...a.portrait.look), portrait)
    if (portrait > 0 && b.portrait) B.lerp(tmpP.current.set(...b.portrait.look), portrait)
    lookTarget.current.lerpVectors(A, B, t)

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

    // в портрете угол шире: буквы на стене из мха и стол с блюдами не режутся
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, t) + portrait * 12
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
