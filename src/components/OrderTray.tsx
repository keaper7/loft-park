'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { rub, trayCount, trayTotal, useStore } from '@/lib/store'
import { scrollToTarget } from '@/lib/scroll'

const EASE = [0.16, 1, 0.3, 1] as const

type Fly = { id: number; x: number; y: number }

/**
 * «Стол» — плавающий предзаказ. Каждое добавление из меню запускает
 * янтарную каплю, которая дугой летит от кнопки к подносу: человек
 * видит, куда делось блюдо, без всплывающих уведомлений.
 */
export function OrderTray() {
  const tray = useStore((s) => s.tray)
  const change = useStore((s) => s.change)
  const clear = useStore((s) => s.clear)
  const [open, setOpen] = useState(false)
  const [flies, setFlies] = useState<Fly[]>([])
  const [bump, setBump] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const count = trayCount(tray)

  useEffect(() => {
    const onFly = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      const id = Date.now() + Math.random()
      setFlies((f) => [...f, { id, x, y }])
      setTimeout(() => {
        setFlies((f) => f.filter((i) => i.id !== id))
        setBump((b) => b + 1)
      }, 750)
    }
    window.addEventListener('tray:fly', onFly)
    return () => window.removeEventListener('tray:fly', onFly)
  }, [])

  useEffect(() => {
    if (count === 0) setOpen(false)
  }, [count])

  const target = () => {
    const r = button.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 80, y: window.innerHeight - 40 }
  }

  return (
    <>
      {flies.map((f) => {
        const t = target()
        return (
          <motion.span
            key={f.id}
            className="pointer-events-none fixed left-0 top-0 z-[70] h-4 w-4 rounded-full bg-amber shadow-[0_0_24px_#ffb561]"
            initial={{ x: f.x - 8, y: f.y - 8, scale: 1 }}
            animate={{ x: [f.x - 8, (f.x + t.x) / 2, t.x - 8], y: [f.y - 8, Math.min(f.y, t.y) - 160, t.y - 8], scale: [1, 1.4, 0.4] }}
            transition={{ duration: 0.75, ease: 'easeInOut', times: [0, 0.45, 1] }}
          />
        )
      })}

      <AnimatePresence>
        {count > 0 && (
          <motion.div
            className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <AnimatePresence>
              {open && (
                <motion.div
                  className="glass w-[min(92vw,360px)] origin-bottom-right rounded-3xl p-5"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="micro text-amber">Ваш стол</span>
                    <button type="button" onClick={clear} className="micro text-[10px] text-[var(--dim-2)] hover:text-cream">
                      Очистить
                    </button>
                  </div>
                  <ul className="no-scrollbar flex max-h-[40vh] flex-col gap-3 overflow-y-auto" data-lenis-prevent>
                    <AnimatePresence initial={false}>
                      {tray.map((i) => (
                        <motion.li key={i.key} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center justify-between gap-3">
                          <span className="text-sm leading-snug">{i.name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <button type="button" aria-label="Меньше" onClick={() => change(i.key, -1)} className="h-7 w-7 rounded-full border border-[var(--hair-strong)]">−</button>
                            <span className="w-4 text-center text-sm tabular-nums">{i.qty}</span>
                            <button type="button" aria-label="Больше" onClick={() => change(i.key, 1)} className="h-7 w-7 rounded-full border border-[var(--hair-strong)]">+</button>
                          </span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--hair)] pt-4">
                    <span className="text-[var(--dim)]">Итого ≈</span>
                    <span className="display text-lg text-ember">{rub(trayTotal(tray))}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      scrollToTarget('#booking')
                    }}
                    className="mt-4 w-full rounded-full bg-amber py-3 font-semibold text-ink"
                  >
                    Добавить к брони →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              ref={button}
              type="button"
              key={bump}
              onClick={() => setOpen((o) => !o)}
              data-cursor={open ? 'Скрыть' : 'Стол'}
              aria-expanded={open}
              className="glass flex items-center gap-3 rounded-full py-2 pl-2 pr-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.45 }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber font-semibold text-ink tabular-nums">{count}</span>
              <span className="text-left leading-tight">
                <span className="micro block text-[10px] text-[var(--dim-2)]">На столе</span>
                <span className="text-sm font-medium">{rub(trayTotal(tray))}</span>
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
