'use client'

import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { menu, type Dish } from '@/content'
import { rub, useStore } from '@/lib/store'
import { SplitText } from './SplitText'

const EASE = [0.16, 1, 0.3, 1] as const

/** Карточка с 3D-наклоном к курсору и бликом, который бежит за мышью */
function DishCard({ dish, index }: { dish: Dish; index: number }) {
  const add = useStore((s) => s.add)
  const qty = useStore((s) => s.tray.find((i) => i.name === dish.name && i.price === dish.price)?.qty ?? 0)
  const ref = useRef<HTMLLIElement>(null)

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`)
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }
  const onLeave = () => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    add(dish.name, dish.price)
    const r = e.currentTarget.getBoundingClientRect()
    window.dispatchEvent(new CustomEvent('tray:fly', { detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))
  }

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(index, 12) * 0.03 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="group relative [perspective:900px]"
    >
      <div
        className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-[var(--hair)] bg-ink-2/80 p-5 transition-[transform,border-color] duration-300 ease-out group-hover:border-amber/40"
        style={{ transform: 'rotateX(var(--rx,0)) rotateY(var(--ry,0))', transformStyle: 'preserve-3d' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: 'radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(255,181,97,0.16), transparent 60%)' }}
        />
        <div className="relative" style={{ transform: 'translateZ(30px)' }}>
          <h4 className="text-[17px] font-medium leading-snug">{dish.name}</h4>
          {dish.note && <p className="micro mt-2 text-[10px] text-[var(--dim-2)]">{dish.note}</p>}
        </div>
        <div className="relative flex items-center justify-between" style={{ transform: 'translateZ(40px)' }}>
          <span className="display text-[15px] text-ember">{rub(dish.price)}</span>
          <button
            type="button"
            onClick={onAdd}
            data-cursor="На стол"
            aria-label={`Добавить «${dish.name}» на стол`}
            className="relative flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-amber/50 px-3 text-amber transition-colors hover:bg-amber hover:text-ink"
          >
            <span className="text-lg leading-none">+</span>
            <AnimatePresence>
              {qty > 0 && (
                <motion.span
                  key={qty}
                  className="micro text-[10px]"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 10, opacity: 0, position: 'absolute' }}
                >
                  {qty}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </motion.li>
  )
}

export function Menu() {
  const [cat, setCat] = useState(menu[1].id)
  const [query, setQuery] = useState('')

  /**
   * Края ленты категорий.
   *
   * Разделов десять, в одну строку 1280 они не помещаются, а полоса
   * прокрутки скрыта (no-scrollbar) — на скриншоте десктопа это выглядело
   * как разрезанная пополам буква «Д» без намёка, что справа есть
   * продолжение. На десктопе обрезку убираем совсем: md:flex-wrap
   * переносит разделы в два ряда, прокрутки там больше нет. Маска нужна
   * только телефону, где ряд один и прокрутка неизбежна, и включается
   * лишь когда прокрутка реально возможна: пока лента в начале, левый край
   * не трогаем; доехали до конца — отпускаем правый. Ширина 18px, а не
   * 26: при 26 фейд заметно съедал правый край активной таблетки, и она
   * выглядела выцветшей — как артефакт, а не как приём. Когда краёв нет,
   * style не выставляется вовсе — лишнего слоя композиции не возникает.
   */
  const strip = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const syncEdge = useCallback(() => {
    const el = strip.current
    if (!el) return
    const l = el.scrollLeft > 4
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdge((p) => (p.l === l && p.r === r ? p : { l, r }))
  }, [])
  useEffect(() => {
    const el = strip.current
    if (!el) return
    syncEdge()
    el.addEventListener('scroll', syncEdge, { passive: true })
    // ширина меняется от поворота экрана и от подгрузки шрифта
    const ro = new ResizeObserver(syncEdge)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', syncEdge)
      ro.disconnect()
    }
  }, [syncEdge])
  const fade = `linear-gradient(to right, transparent 0, #000 ${edge.l ? '18px' : '0px'}, #000 calc(100% - ${edge.r ? '18px' : '0px'}), transparent 100%)`

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) return menu.flatMap((c) => c.items).filter((d) => d.name.toLowerCase().includes(q))
    return menu.find((c) => c.id === cat)?.items ?? []
  }, [cat, query])

  const total = useMemo(() => menu.reduce((n, c) => n + c.items.length, 0), [])

  return (
    <section id="menu" data-cam="7" className="relative px-[var(--pad)] py-[18vh]">
      <div className="glass mx-auto max-w-[1320px] rounded-[28px] px-[clamp(18px,3vw,48px)] py-[clamp(28px,5vw,64px)]">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="micro mb-4 text-amber">Меню · {total} позиций</p>
            <SplitText text="Что на столе" className="display text-[clamp(44px,7vw,120px)]" />
          </div>
          <p className="max-w-[360px] text-sm leading-relaxed text-[var(--dim-2)]">
            Нажмите «+», чтобы собрать стол заранее — список уйдёт вместе с бронью. Цены ориентировочные, по открытым источникам.
          </p>
        </div>

        {/* Одна строка и глухой фон — на телефоне здесь было две строки
            (табы, под ними поиск) с фоном bg-ink/95. Панель занимала почти
            четверть экрана, а сквозь оставшиеся 5% прозрачности просвечивали
            карточки, уезжающие под неё: на скриншоте сквозь поиск читалось
            «Картофель на углях», а сквозь табы — цена. Выглядело как
            сломанная вёрстка. Тень отделяет панель от списка под ней. */}
        <div className="sticky top-[84px] z-20 -mx-2 mt-10 flex items-center gap-2 rounded-2xl bg-ink p-2 shadow-[0_12px_28px_rgba(12,10,8,0.75)] md:gap-3">
          <LayoutGroup id="menu-tabs">
            {/* data-lenis-prevent нужен только в режиме ?sync: там Lenis
                забирает touchmove себе и лента категорий перестаёт листаться
                пальцем вбок. По умолчанию тач теперь родной, и атрибут
                просто ни на что не влияет */}
            <div
              ref={strip}
              className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-wrap md:overflow-x-visible"
              role="tablist"
              aria-label="Категории меню"
              data-lenis-prevent
              style={edge.l || edge.r ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
            >
              {menu.map((c) => {
                const on = !query && c.id === cat
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="menu-items"
                    onClick={(e) => {
                      setCat(c.id)
                      setQuery('')
                      // раздел у края ленты мог быть виден наполовину;
                      // block: 'nearest' — чтобы страница не поехала вверх
                      e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
                    }}
                    className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${on ? 'text-ink' : 'text-[var(--dim)] hover:text-cream'}`}
                  >
                    {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-amber" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span className="relative">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </LayoutGroup>
          {/* Узкий на телефоне: панель теперь одна строка, и поиск
              обязан ужиматься, иначе выдавливает табы за экран */}
          <label className="relative flex w-[36%] max-w-[168px] shrink-0 items-center md:w-60 md:max-w-none">
            <span className="sr-only">Поиск по меню</span>
            <svg className="pointer-events-none absolute left-4 h-4 w-4 text-[var(--dim-2)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти блюдо"
              className="w-full rounded-full border border-[var(--hair)] bg-transparent py-2.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--dim-2)] focus:border-amber md:w-60"
            />
          </label>
        </div>

        <motion.ul layout id="menu-items" role="tabpanel" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {items.map((d, i) => (
              <DishCard key={`${query ? 'q' : cat}-${d.name}-${d.price}`} dish={d} index={i} />
            ))}
          </AnimatePresence>
        </motion.ul>
        {items.length === 0 && <p className="mt-10 text-center text-[var(--dim-2)]">Ничего не нашли — попробуйте «хычин» или «ролл».</p>}
      </div>
    </section>
  )
}
