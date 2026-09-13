'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { startAmbient, stopAmbient } from '@/lib/ambient'

/** Кнопка звука: эквалайзер из четырёх полосок, живой, пока звук включён */
export function SoundToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const sound = useStore((s) => s.sound)
  const toggle = useStore((s) => s.toggleSound)

  useEffect(() => {
    if (sound) startAmbient()
    else stopAmbient()
  }, [sound])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={sound}
      aria-label={sound ? 'Выключить звук атмосферы' : 'Включить звук атмосферы'}
      data-cursor={sound ? 'Тише' : 'Звук'}
      className={`group inline-flex items-center gap-3 ${className}`}
    >
      <span className="flex h-4 items-end gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-amber"
            style={{
              height: sound ? undefined : 4,
              animation: sound ? `eq 0.${7 + i}s ease-in-out ${i * 0.1}s infinite alternate` : undefined,
            }}
          />
        ))}
      </span>
      {withLabel && <span className="micro">{sound ? 'Звук включён' : 'Включить атмосферу'}</span>}
      <style>{`@keyframes eq{from{height:3px}to{height:16px}}`}</style>
    </button>
  )
}
