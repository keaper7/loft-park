'use client'

import { useEffect, useRef } from 'react'

/**
 * Плёночное зерно поверх страницы. Плитка шума 160×160 рисуется на canvas
 * один раз и становится фоном — дешёвая растровая картинка вместо SVG-фильтра,
 * который браузер пересчитывал для огромного слоя (см. .grain в globals.css).
 */
export function Grain() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 160
    const g = c.getContext('2d')
    if (!g || !ref.current) return
    const img = g.createImageData(160, 160)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 60 + Math.random() * 160
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
    ref.current.style.backgroundImage = `url(${c.toDataURL('image/png')})`
  }, [])

  return <div ref={ref} className="grain" aria-hidden="true" />
}
