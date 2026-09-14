'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

const EASE = [0.16, 1, 0.3, 1] as const

/** Единственная reveal-обёртка: одна кривая и дистанция на весь сайт */
export function Reveal({
  children,
  delay = 0,
  y = 30,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <motion.div
      className={className}
      // Без filter: blur — анимация фильтра стартует прямо во время прокрутки,
      // и слой с фильтром поверх WebGL-холста мигал чёрными прямоугольниками
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: reduced ? 0.2 : 1, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  )
}
