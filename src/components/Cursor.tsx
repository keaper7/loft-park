'use client'

import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * Курсор — «фонарик»: точка, кольцо с запаздыванием и большое тёплое
 * пятно, которое подсвечивает страницу под собой.
 * Над элементами с data-cursor="Текст" кольцо раскрывается в подпись.
 * Только для мыши: на тач-экранах компонент ничего не рисует.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState<string | null>(null)
  const [down, setDown] = useState(false)
  const x = useMotionValue(-200)
  const y = useMotionValue(-200)
  const rx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.5 })
  const ry = useSpring(y, { stiffness: 380, damping: 32, mass: 0.5 })
  const gx = useSpring(x, { stiffness: 60, damping: 20 })
  const gy = useSpring(y, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return
    setEnabled(true)
    document.documentElement.classList.add('has-cursor')

    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-cursor], a, button')
      if (!el) return setLabel(null)
      setLabel(el.dataset.cursor ?? '')
    }
    const d = () => setDown(true)
    const u = () => setDown(false)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', d)
    window.addEventListener('pointerup', u)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', d)
      window.removeEventListener('pointerup', u)
    }
  }, [x, y])

  if (!enabled) return null
  const active = label !== null
  const hasText = !!label

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90]">
      <motion.div
        className="absolute left-0 top-0 h-[460px] w-[460px] rounded-full"
        style={{
          x: gx,
          y: gy,
          translateX: '-50%',
          translateY: '-50%',
          // Без mix-blend-mode: screen поверх WebGL-холста при прокрутке давал
          // мигающие тёмные квадраты размером с само пятно
          background: 'radial-gradient(circle, rgba(255,170,90,0.08), rgba(255,140,60,0.025) 40%, transparent 70%)',
        }}
      />
      <motion.div
        className="absolute left-0 top-0 flex items-center justify-center rounded-full border border-amber/60"
        style={{ x: rx, y: ry, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: hasText ? 96 : active ? 56 : 34,
          height: hasText ? 96 : active ? 56 : 34,
          backgroundColor: hasText ? 'rgba(255,181,97,0.95)' : 'rgba(255,181,97,0)',
          scale: down ? 0.85 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {hasText && <span className="micro px-2 text-center text-[10px] font-medium leading-tight text-ink">{label}</span>}
      </motion.div>
      <motion.div
        className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-amber"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
        animate={{ opacity: hasText ? 0 : 1 }}
      />
    </div>
  )
}
