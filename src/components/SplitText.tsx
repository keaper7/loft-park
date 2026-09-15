'use client'

import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * Заголовок, который выезжает по буквам из-под маски. Слова не
 * разрываются: перенос строки происходит между словами-блоками, а буквы
 * внутри слова анимируются по отдельности.
 */
export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.022,
  as = 'h2',
}: {
  text: string
  className?: string
  delay?: number
  stagger?: number
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
}) {
  const reduced = usePrefersReducedMotion()
  const Tag = motion[as] as typeof motion.h2
  const words = text.split(' ')
  let n = 0

  return (
    <Tag
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      {words.map((word, wi) => (
        <span key={wi} aria-hidden="true" className="inline-block whitespace-nowrap overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom">
          {Array.from(word).map((ch, ci) => {
            const i = n++
            return (
              <motion.span
                key={ci}
                // без will-change: сотни букв навсегда оставались отдельными
                // GPU-слоями, и под нагрузкой браузер выгружал их плитки
                className="inline-block"
                variants={{
                  hidden: reduced ? { opacity: 0 } : { y: '110%', rotate: 8, opacity: 0 },
                  show: { y: '0%', rotate: 0, opacity: 1 },
                }}
                transition={{ duration: reduced ? 0.2 : 0.9, ease: EASE, delay: reduced ? 0 : delay + i * stagger }}
              >
                {ch}
              </motion.span>
            )
          })}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  )
}
