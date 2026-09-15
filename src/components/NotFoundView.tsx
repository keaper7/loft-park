'use client'

import { useEffect, useState } from 'react'

/**
 * Главная — полная загрузка, а не переход роутером: сайт одностраничный,
 * и главной нужны прелоадер, замер маркеров камеры и закрепления GSAP
 * с чистого листа. Подпуть приходит из next.config.ts: /loft-park в
 * сборке для GitHub Pages и пусто в `npm run dev`.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const HOME = `${BASE}/`
const SECONDS = 6

export function NotFoundView() {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    // Если 404 вдруг показалась на самой главной, автопереход ушёл бы
    // в бесконечную перезагрузку — там оставляем только кнопку
    const path = window.location.pathname.replace(/index\.html$/, '')
    const onHome = path === HOME || path === BASE
    if (onHome) return
    let n = SECONDS
    setLeft(n)
    const id = window.setInterval(() => {
      n -= 1
      setLeft(n)
      if (n <= 0) {
        window.clearInterval(id)
        window.location.replace(HOME)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-[var(--pad)] py-32 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 60% at 50% 50%, rgba(12,10,8,0.82), rgba(12,10,8,0) 75%)' }}
      />
      <div className="relative flex flex-col items-center">
        <p className="micro mb-6 text-amber">Ошибка 404</p>
        <h1 className="display neon text-[clamp(88px,18vw,260px)] leading-[0.82]">404</h1>
        <p className="serif mt-8 max-w-[24ch] text-[clamp(26px,3vw,42px)] leading-[1.08]">Такой страницы нет — а лофт на месте</p>
        <p className="mt-5 max-w-[440px] leading-relaxed text-[var(--dim)]">
          Сайт одностраничный: дорога через парк, меню и бронь — всё на главной. Похоже, ссылка обрезалась или устарела.
        </p>
        <a
          href={HOME}
          data-cursor="Домой"
          className="mt-10 rounded-full bg-amber px-7 py-4 font-semibold text-ink shadow-[0_0_40px_rgba(255,181,97,0.45)]"
        >
          На главную
        </a>
        <p className="micro mt-6 h-4 text-[10px] text-[var(--dim-2)]">{left !== null && left > 0 ? `Откроем главную сами через ${left} с` : ''}</p>
      </div>
    </section>
  )
}
