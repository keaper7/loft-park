'use client'

import { useEffect, useState } from 'react'
import { openStatus } from '@/lib/openHours'

/**
 * Живой статус «открыто · закроется через …». До гидратации не рисует
 * ничего: время на сервере сборки и у посетителя всегда разное.
 */
export function OpenStatus({ className = '' }: { className?: string }) {
  const [s, setS] = useState<ReturnType<typeof openStatus> | null>(null)

  useEffect(() => {
    const update = () => setS(openStatus())
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  if (!s) return <span className={`inline-block h-4 ${className}`} />

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-2 w-2">
        {s.isOpen && <span className="absolute inset-0 rounded-full bg-moss" style={{ animation: 'pulse-ring 1.8s ease-out infinite' }} />}
        <span className={`relative h-2 w-2 rounded-full ${s.isOpen ? 'bg-moss' : 'bg-ember'}`} />
      </span>
      <span>
        {s.isOpen ? 'Открыто' : 'Закрыто'} <span className="text-[var(--dim-2)]">· {s.label}</span>
      </span>
    </span>
  )
}
