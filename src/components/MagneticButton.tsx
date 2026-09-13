'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

/**
 * Кнопка, которая слегка тянется к курсору. Смещение намеренно маленькое
 * (максимум ~10px): достаточно, чтобы палец «почувствовал» отклик, и мало,
 * чтобы цель не убегала от клика.
 *
 * На тач-устройствах и при prefers-reduced-motion эффект не включается —
 * там он либо бессмыслен, либо нежелателен.
 */
export function MagneticButton({
  children,
  href,
  className,
  strength = 0.28,
  ...rest
}: {
  children: ReactNode
  href: string
  className?: string
  strength?: number
  /* Обработчики анимации и драга у motion свои — исключаем, иначе
     типы React и motion конфликтуют на одном и том же имени пропса. */
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'style' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLAnchorElement>(null)

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 260, damping: 22, mass: 0.4 })
  const y = useSpring(my, { stiffness: 260, damping: 22, mass: 0.4 })

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduced || !ref.current) return
    if (window.matchMedia('(hover: none)').matches) return
    const r = ref.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    mx.set(Math.max(-14, Math.min(14, dx * strength)))
    my.set(Math.max(-10, Math.min(10, dy * strength)))
  }

  const reset = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onBlur={reset}
      {...rest}
    >
      {children}
    </motion.a>
  )
}
