'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Один хук на весь сайт. Возвращает `true`, когда пользователь просил
 * убрать движение — тогда canvas, параллакс, marquee и Lenis выключаются,
 * а reveal-анимации схлопываются в мгновенное появление.
 *
 * Стартует с `false` и на сервере, и на клиенте: иначе первый рендер
 * разошёлся бы с серверным и React ругался бы на гидратацию.
 * Реальное значение подставляется в эффекте, до первой краски.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    setReduced(mq.matches)

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
