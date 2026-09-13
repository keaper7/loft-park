'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { kitchens } from '@/content'
import { scrollState } from '@/lib/scroll'
import { rub } from '@/lib/store'

const EASE = [0.16, 1, 0.3, 1] as const
const FIRST_CAM = 4

/**
 * Три кухни за одним столом. Контейнер высотой 3 экрана, внутри —
 * закреплённый экран. Три маркера data-cam (4, 5, 6) стоят на 1/6, 3/6
 * и 5/6 высоты: камера переезжает от блюда к блюду, а текст слева
 * меняется синхронно, считывая текущий кадр из scrollState.
 */
export function Kitchens() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const idx = Math.max(0, Math.min(2, Math.round(scrollState.cam - FIRST_CAM)))
      setActive((prev) => (prev === idx ? prev : idx))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const k = kitchens[active]

  return (
    <section id="kitchens" className="relative h-[330vh]" aria-label="Три кухни">
      {kitchens.map((_, i) => (
        <div key={i} data-cam={FIRST_CAM + i} className="absolute left-0 h-0 w-0" style={{ top: `${((i * 2 + 1) / 6) * 100}%` }} />
      ))}

      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="scrim absolute inset-y-0 left-0 w-full md:w-2/3" />
        <div className="relative w-full px-[var(--pad)]">
          <p className="micro mb-6 text-amber">Три кухни · один стол</p>

          <div className="flex items-baseline gap-4">
            <span className="display text-[clamp(18px,1.6vw,24px)] tabular-nums text-amber">{k.index}</span>
            <span className="micro text-[var(--dim-2)]">/ 03</span>
          </div>

          <div className="relative h-[clamp(48px,11vw,190px)] overflow-hidden">
            <AnimatePresence mode="popLayout">
              <motion.h3
                key={k.id}
                className="display absolute left-0 top-0 text-[clamp(42px,11vw,190px)]"
                initial={{ y: '100%', opacity: 0, filter: 'blur(12px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: '-100%', opacity: 0, filter: 'blur(12px)' }}
                transition={{ duration: 0.9, ease: EASE }}
              >
                {k.name}
              </motion.h3>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={k.id}
              className="mt-8 max-w-[440px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="flex items-end justify-between gap-6 border-b border-[var(--hair-strong)] pb-4">
                <span className="serif text-[clamp(24px,2.4vw,36px)] leading-none">{k.dish}</span>
                <span className="display shrink-0 whitespace-nowrap text-lg text-ember">{rub(k.price)}</span>
              </div>
              <p className="mt-5 leading-relaxed text-[var(--dim)]">{k.text}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex items-center gap-3">
            {kitchens.map((item, i) => (
              <span key={item.id} className="relative h-[3px] w-14 overflow-hidden rounded-full bg-[var(--hair)]">
                <motion.span className="absolute inset-0 origin-left bg-amber" animate={{ scaleX: i <= active ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }} />
              </span>
            ))}
            <span className="micro ml-3 text-[var(--dim-2)]">Листайте — блюдо соберётся</span>
          </div>
        </div>
      </div>
    </section>
  )
}
