'use client'

import { useEffect, useRef } from 'react'
import { scrollState } from '@/lib/scroll'

const LABELS = ['Вход', 'Аллея', 'Площадь', 'Терраса', 'Кавказ', 'Италия', 'Япония', 'Меню', 'Вечера', 'Шатёр', 'Бронь', 'Карта']

/**
 * Неоновая трубка справа: заполняется по мере скролла, рядом — название
 * текущей главы путешествия. Обновляется напрямую в DOM из rAF.
 */
export function ScrollProgress() {
  const fill = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const num = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      if (fill.current) fill.current.style.transform = `scaleY(${scrollState.progress})`
      const idx = Math.min(LABELS.length - 1, Math.round(scrollState.cam))
      if (idx !== last && label.current && num.current) {
        last = idx
        label.current.textContent = LABELS[idx]
        num.current.textContent = String(idx).padStart(2, '0')
        label.current.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out' })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 items-center gap-4 md:flex">
      <div className="micro flex flex-col items-end text-right text-[10px]">
        <span ref={num} className="text-amber">00</span>
        <span ref={label} className="text-[var(--dim)]">Вход</span>
      </div>
      <div className="relative h-[34vh] w-[3px] overflow-hidden rounded-full bg-[var(--hair)]">
        <div
          ref={fill}
          className="absolute inset-0 origin-top rounded-full"
          style={{
            transform: 'scaleY(0)',
            background: 'linear-gradient(to bottom, #ffe2b8, #ffb561 60%, #ff7a3d)',
            boxShadow: '0 0 12px rgba(255,181,97,0.9)',
          }}
        />
      </div>
    </div>
  )
}
