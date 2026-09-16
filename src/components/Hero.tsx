'use client'

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { chapters } from '@/content'
import { useStore } from '@/lib/store'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { MagneticButton } from './MagneticButton'

const EASE = [0.16, 1, 0.3, 1] as const

function Letter({ ch, i, total, progress, show, reduced }: { ch: string; i: number; total: number; progress: MotionValue<number>; show: boolean; reduced: boolean }) {
  const spread = (i - (total - 1) / 2) / total
  // Уходя, буквы разлетаются веером и растворяются — «вход» в сцену
  const y = useTransform(progress, [0, 1], [0, reduced ? 0 : -260 - Math.abs(spread) * 300])
  const x = useTransform(progress, [0, 1], [0, reduced ? 0 : spread * 500])
  const rotate = useTransform(progress, [0, 1], [0, reduced ? 0 : spread * 40])
  const opacity = useTransform(progress, [0, 0.7], [1, 0])
  return (
    <motion.span className="inline-block" style={{ y, x, rotate, opacity }}>
      <motion.span
        className="inline-block"
        initial={{ y: '100%', rotateX: -90, opacity: 0 }}
        animate={show ? { y: '0%', rotateX: 0, opacity: 1 } : undefined}
        transition={{ duration: 1.3, ease: EASE, delay: 0.25 + i * 0.07 }}
        style={{ transformOrigin: '50% 100%' }}
      >
        {ch}
      </motion.span>
    </motion.span>
  )
}

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const show = useStore((s) => s.introDone)
  const reduced = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const fade = useTransform(scrollYProgress, [0, 0.45], [1, 0])
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120])
  const { title, eyebrow, lead } = chapters.hero
  const word = title.join(' ')
  const letters = Array.from(word)

  return (
    <section id="top" ref={ref} data-cam="0" className="relative flex min-h-[100svh] flex-col justify-end px-[var(--pad)] pb-[8vh] pt-32">
      {/* Появление и затухание по скроллу — на разных элементах. На одном
          initial-прозрачность и style-прозрачность от скролла спорили:
          сервер рисовал 1, клиент 0 — ошибка гидратации в консоли */}
      <motion.div style={{ opacity: fade }} className="mb-6 flex flex-col items-start gap-3">
        {/* Бейдж на самом первом экране, а не только в футере: если сайт
            уходит в сторис/рилс, зритель видит «это концепт» с первого кадра,
            а не долистав до конца одностраничника */}
        <motion.span
          className="glass micro inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] text-[var(--dim)]"
          initial={{ opacity: 0, y: 12 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1, ease: EASE, delay: 0.05 }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
          Концепт для портфолио · не официальный сайт
        </motion.span>
        <motion.p
          className="micro text-amber"
          initial={{ opacity: 0, y: 12 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
        >
          {eyebrow}
        </motion.p>
      </motion.div>

      {/* нижняя граница 40px: при 52px «LOFT PARK» на 375px вылезал на 2px за край */}
      <h1 className="display neon text-[clamp(40px,12.6vw,250px)] leading-[0.82]" style={{ perspective: 800 }} aria-label="Loft Park">
        <span aria-hidden="true" className="whitespace-nowrap">
          {letters.map((ch, i) =>
            ch === ' ' ? (
              <span key={i} className="inline-block w-[0.3em]" />
            ) : (
              <Letter key={i} ch={ch} i={i} total={letters.length} progress={scrollYProgress} show={show} reduced={reduced} />
            ),
          )}
        </span>
      </h1>

      <motion.div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between" style={{ opacity: fade, y: lift }}>
        <motion.p
          className="serif max-w-[22ch] text-[clamp(26px,3vw,44px)] leading-[1.05] text-cream"
          initial={{ opacity: 0, y: 30 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1.2, ease: EASE, delay: 1 }}
        >
          {lead}
        </motion.p>
        <motion.div
          className="flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1.2, ease: EASE, delay: 1.15 }}
        >
          <MagneticButton href="#booking" data-cursor="Бронь" className="rounded-full bg-amber px-7 py-4 font-semibold text-ink shadow-[0_0_40px_rgba(255,181,97,0.45)]">
            Забронировать стол
          </MagneticButton>
          <MagneticButton href="#menu" data-cursor="Меню" className="glass rounded-full px-7 py-4 font-medium">
            Смотреть меню
          </MagneticButton>
        </motion.div>
      </motion.div>

      <motion.a
        href="#park"
        className="micro absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-[var(--dim-2)] md:block"
        style={{ opacity: fade }}
        data-cursor="В парк"
      >
        <motion.span
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ delay: 1.8, duration: 1 }}
        >
          Листайте — идём в парк
          <span className="relative h-10 w-px overflow-hidden bg-[var(--hair)]">
            <motion.span
              className="absolute inset-x-0 top-0 h-1/2 bg-amber"
              animate={reduced ? undefined : { y: ['-100%', '200%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
        </motion.span>
      </motion.a>
    </section>
  )
}
