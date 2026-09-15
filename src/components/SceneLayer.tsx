'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { useStore } from '@/lib/store'

const Experience = dynamic(() => import('./scene/Experience'), { ssr: false })

/**
 * Фиксированный 3D-фон всей страницы. Грузится только на клиенте:
 * three.js на сервере не нужен и весит сотни килобайт.
 *
 * Качество выбирается один раз: узкий экран или слабый процессор —
 * режим «low» (меньше деревьев и светлячков, без MSAA). Нет WebGL —
 * вместо сцены тёплый градиент, сайт остаётся полностью рабочим.
 */
export function SceneLayer() {
  const reduced = usePrefersReducedMotion()
  const setReady = useStore((s) => s.setSceneReady)
  const [mode, setMode] = useState<null | 'high' | 'low' | 'none'>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) {
      setMode('none')
      setReady()
      return
    }
    const narrow = window.matchMedia('(max-width: 820px)').matches
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4
    setMode(narrow || weak ? 'low' : 'high')
  }, [setReady])

  return (
    // h-lvh, а не inset-0: на телефоне при скролле прячется адресная строка,
    // видимая высота меняется, и холст пересоздавал буфер — вспышка чёрным.
    // Большая высота вьюпорта постоянна, холст не меняет размер никогда.
    <div className="fixed left-0 top-0 z-0 h-lvh w-full" aria-hidden="true">
      {mode === 'none' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 110%, rgba(255,150,60,0.28), transparent 60%), radial-gradient(60% 50% at 20% 0%, rgba(70,90,140,0.25), transparent 60%), #0c0a08',
          }}
        />
      )}
      {(mode === 'high' || mode === 'low') && <Experience quality={mode} reduced={reduced} />}
      {/* нижняя подложка: текст у края экрана остаётся читаемым на любом кадре */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/70 to-transparent" />
    </div>
  )
}
