'use client'

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useState } from 'react'
import { brand, contact, nav } from '@/content'
import { useStore } from '@/lib/store'
import { getLenis } from '@/lib/scroll'
import { MagneticButton } from './MagneticButton'
import { OpenStatus } from './OpenStatus'
import { SoundToggle } from './SoundToggle'

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * Шапка прячется при скролле вниз и возвращается при скролле вверх:
 * 3D-сцена — главный экран сайта, и постоянная полоса сверху её режет.
 */
export function Nav() {
  const introDone = useStore((s) => s.introDone)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (v) => {
    const prev = scrollY.getPrevious() ?? 0
    setHidden(v > prev && v > 200)
  })

  useEffect(() => {
    const l = getLenis()
    if (open) l?.stop()
    else l?.start()
  }, [open])

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 px-[var(--pad)] pt-5"
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: introDone && (!hidden || open) ? 0 : -90, opacity: introDone ? 1 : 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div className="glass flex items-center justify-between gap-6 rounded-full py-2.5 pl-6 pr-2.5">
          <a href="#top" className="display neon flicker whitespace-nowrap text-[15px] tracking-[0.02em]" data-cursor="Наверх">
            {brand.name}
          </a>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Разделы">
            {nav.map((l) => (
              <a key={l.href} href={l.href} className="group relative text-sm text-[var(--dim)] transition-colors hover:text-cream">
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-amber transition-transform duration-500 ease-[var(--ease)] group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            {/* обёртка: у OpenStatus свой inline-flex, он перебил бы hidden */}
            <span className="hidden xl:block">
              <OpenStatus className="micro text-[10px]" />
            </span>
            <SoundToggle className="hidden sm:inline-flex" />
            <MagneticButton
              href="#booking"
              data-cursor="Бронь"
              className="hidden rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_0_30px_rgba(255,181,97,0.35)] sm:inline-block"
            >
              Забронировать
            </MagneticButton>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hair-strong)] lg:hidden"
              aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <motion.span className="absolute h-px w-4 bg-cream" animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }} />
              <motion.span className="absolute h-px w-4 bg-cream" animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink/95 px-[var(--pad)] pb-10 pt-32 backdrop-blur-xl lg:hidden"
            initial={{ clipPath: 'circle(0% at 92% 6%)' }}
            animate={{ clipPath: 'circle(150% at 92% 6%)' }}
            exit={{ clipPath: 'circle(0% at 92% 6%)' }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <nav className="flex flex-col gap-2" aria-label="Разделы">
              {[...nav, { href: '#top', label: 'Наверх' }].map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="display text-[clamp(36px,11vw,64px)]"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: EASE }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <div className="flex flex-col gap-3 text-[var(--dim)]">
              <OpenStatus className="micro" />
              <a href={contact.phoneHref} className="text-lg text-cream">{contact.phone}</a>
              <SoundToggle withLabel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
