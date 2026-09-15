'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

const EASE = [0.76, 0, 0.24, 1] as const

/**
 * Неоновая вывеска «прогревается»: контур букв прорисовывается, счётчик
 * бежит к 100, затем трубка вспыхивает с характерным мерцанием, и шторки
 * расходятся — за ними уже отрисованный ночной парк.
 *
 * Уходит не раньше, чем сцена отдала первый кадр (иначе за шторкой
 * была бы чёрная пустота), но и не позже 7 секунд — на слабом железе
 * лучше показать сайт без 3D, чем держать человека на заставке.
 */
export function Preloader() {
  const sceneReady = useStore((s) => s.sceneReady)
  const setIntroDone = useStore((s) => s.setIntroDone)
  const [count, setCount] = useState(0)
  const [lit, setLit] = useState(false)
  const [gone, setGone] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 2200)
      setCount(Math.round(100 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const t = setTimeout(() => setTimedOut(true), 7000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (count >= 100 && (sceneReady || timedOut)) setLit(true)
  }, [count, sceneReady, timedOut])

  // Отдельный эффект: если бы уход жил в эффекте выше, setLit перезапускал
  // бы его, cleanup снимал таймер — и шторка не уходила никогда.
  useEffect(() => {
    if (!lit) return
    const t = setTimeout(() => {
      setGone(true)
      setIntroDone()
    }, 1100)
    return () => clearTimeout(t)
  }, [lit, setIntroDone])

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center" exit={{ pointerEvents: 'none' }} transition={{ duration: 1.2 }}>
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 bg-ink"
            exit={{ y: '-100%' }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-ink"
            exit={{ y: '100%' }}
            transition={{ duration: 1.1, ease: EASE }}
          />

          <motion.div className="relative flex flex-col items-center" exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.6 }}>
            {/* Пока лампы «прогреваются» — SVG-контур, который прорисовывается
                по счётчику. Загорается уже HTML-текст с неоновым text-shadow:
                мягкое свечение без SVG-фильтра (размытие во весь экран в момент
                старта 3D давало мигание), а толстые обводки-«ореолы» выглядели
                дутыми буквами, а не светом */}
            <div className="relative w-[min(86vw,820px)]">
              <svg
                viewBox="0 0 900 180"
                className="block w-full overflow-visible"
                role="img"
                aria-label="Loft Park"
                style={{ opacity: lit ? 0 : 1, transition: 'opacity .25s' }}
              >
                <text
                  x="450"
                  y="128"
                  textAnchor="middle"
                  className="display"
                  style={{
                    fontSize: 136,
                    fill: 'transparent',
                    // У вариативного шрифта контуры букв перекрываются — поэтому
                    // только обводка, без заливки
                    stroke: 'rgba(255,181,97,0.55)',
                    strokeWidth: 1.6,
                    strokeDasharray: 1400,
                    strokeDashoffset: 1400 - (count / 100) * 1400,
                  }}
                >
                  LOFT PARK
                </text>
              </svg>
              {lit && (
                <div
                  aria-hidden="true"
                  className="display neon absolute inset-0 flex items-center justify-center whitespace-nowrap"
                  // 136 / 900 — тот же размер, что у SVG-текста в его viewBox
                  style={{ fontSize: 'calc(min(86vw, 820px) * 0.1511)', animation: 'flicker-on 1s linear both' }}
                >
                  LOFT PARK
                </div>
              )}
            </div>
            <div className="micro mt-6 flex w-[min(86vw,820px)] items-center justify-between text-[var(--dim-2)]">
              <span>Нальчик · ЦПКиО</span>
              <span className="tabular-nums text-amber">{String(count).padStart(3, '0')}</span>
              <span>{lit ? 'Свет включён' : 'Прогреваем лампы'}</span>
            </div>
          </motion.div>
          <style>{`@keyframes flicker-on{0%{opacity:.2}8%{opacity:1}12%{opacity:.3}20%{opacity:1}26%{opacity:.5}32%,100%{opacity:1}}`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
