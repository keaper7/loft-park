'use client'

import { useEffect, useState } from 'react'

/**
 * Возвращает `false` на первом рендере (и на сервере) и уточняет значение
 * в эффекте. Так серверная и клиентская разметка совпадают, а «тяжёлые»
 * десктопные режимы включаются уже после гидратации.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
