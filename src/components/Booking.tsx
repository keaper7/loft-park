'use client'

import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { booking, contact } from '@/content'
import { rub, trayCount, trayTotal, useStore } from '@/lib/store'
import { bookingMessage, whatsappLink } from '@/lib/whatsapp'
import { moscowNow } from '@/lib/openHours'
import { SplitText } from './SplitText'

const EASE = [0.16, 1, 0.3, 1] as const
const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const mon = new Intl.DateTimeFormat('ru-RU', { month: 'short' })

function Chip({ on, children, onClick, disabled, group }: { on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean; group: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${on ? 'border-amber text-ink' : 'border-[var(--hair)] text-[var(--dim)] hover:border-[var(--hair-strong)] hover:text-cream'}`}
    >
      {on && <motion.span layoutId={`chip-${group}`} className="absolute inset-0 rounded-[10px] bg-amber" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      <span className="relative">{children}</span>
    </button>
  )
}

/**
 * Бронь: карточка-форма, которая по «Собрать бронь» переворачивается
 * табличкой RESERVED с готовым текстом — и кнопкой в WhatsApp.
 * Даты считаются только на клиенте: на сборке статики «сегодня» другое.
 */
export function Booking() {
  const tray = useStore((s) => s.tray)
  const [days, setDays] = useState<Date[]>([])
  const [nowMin, setNowMin] = useState(0)
  const [day, setDay] = useState(0)
  const [time, setTime] = useState('19:30')
  const [guests, setGuests] = useState(2)
  const [zone, setZone] = useState(booking.zones[0])
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [withTray, setWithTray] = useState(true)
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    const { date, minutes } = moscowNow()
    setNowMin(minutes)
    setDays(Array.from({ length: 14 }, (_, i) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + i)))
  }, [])

  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const timeDisabled = (t: string) => day === 0 && toMin(t) < nowMin + 30
  // Поздно вечером на сегодня не остаётся ни одного слота: «сегодня»
  // выключаем и сразу переносим выбор на завтра
  const noneToday = booking.times.every((t) => toMin(t) < nowMin + 30)

  useEffect(() => {
    if (!days.length) return
    if (day === 0 && noneToday) {
      setDay(1)
      return
    }
    if (timeDisabled(time)) {
      const free = booking.times.find((t) => !timeDisabled(t))
      if (free) setTime(free)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, nowMin, days.length])

  const message = useMemo(
    () =>
      days.length
        ? bookingMessage({ date: days[day], time, guests, zone, name, comment, tray: withTray ? tray : [] })
        : '',
    [days, day, time, guests, zone, name, comment, tray, withTray],
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setShake((s) => s + 1)
      return
    }
    setDone(true)
  }

  return (
    <section id="booking" data-cam="10" className="relative px-[var(--pad)] py-[14vh]">
      {/* min-w-0 у колонок обязателен: лента дат шире колонки, и без него
          grid растягивал правую колонку за край экрана */}
      <div className="scrim mx-auto grid max-w-[1320px] gap-10 rounded-[28px] lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <div className="min-w-0">
          <p className="micro mb-4 text-amber">{booking.eyebrow}</p>
          {/* «Забронировать» — 13 широких букв Unbounded без переноса: размер
              подобран так, чтобы слово влезало в левую колонку от 1024px */}
          <SplitText text={booking.title} className="display text-[clamp(30px,3.4vw,66px)]" />
          <p className="mt-6 max-w-[440px] leading-relaxed text-[var(--dim)]">{booking.text}</p>
          <div className="mt-8 flex flex-col gap-2 text-[var(--dim)]">
            <span className="micro text-[10px] text-[var(--dim-2)]">Или напрямую</span>
            <a href={contact.phoneHref} className="display text-xl text-cream" data-cursor="Звонок">
              {contact.phone}
            </a>
          </div>
        </div>

        <div className="min-w-0 [perspective:1600px]">
          <motion.div
            className="relative grid [transform-style:preserve-3d]"
            animate={{ rotateY: done ? 180 : 0 }}
            transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1] }}
          >
            {/* ── лицевая сторона: форма ── */}
            <form
              onSubmit={submit}
              className="glass col-start-1 row-start-1 min-w-0 rounded-[28px] p-[clamp(20px,3vw,40px)] [backface-visibility:hidden]"
              aria-hidden={done}
              inert={done}
            >
              <LayoutGroup id="booking">
                {/* min-w-0: у fieldset по умолчанию min-width = ширине содержимого,
                    и лента из 14 дат растягивала его на 700 px за край вместо
                    собственной прокрутки — дальние даты были недоступны */}
                <fieldset className="min-w-0">
                  <legend className="micro mb-3 text-[10px] text-[var(--dim-2)]">Дата</legend>
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-lenis-prevent>
                    {days.map((d, i) => (
                      <Chip key={i} group="day" on={i === day} disabled={i === 0 && noneToday} onClick={() => setDay(i)}>
                        <span className="flex w-10 flex-col items-center leading-tight">
                          <span className="micro text-[9px] opacity-80">{i === 0 ? 'сег' : i === 1 ? 'зав' : wd.format(d)}</span>
                          <span className="display text-lg">{d.getDate()}</span>
                          <span className="text-[10px] opacity-70">{mon.format(d).replace('.', '')}</span>
                        </span>
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-6">
                  <legend className="micro mb-3 text-[10px] text-[var(--dim-2)]">Время</legend>
                  <div className="flex flex-wrap gap-2">
                    {booking.times.map((t) => (
                      <Chip key={t} group="time" on={t === time} disabled={timeDisabled(t)} onClick={() => setTime(t)}>
                        <span className="tabular-nums">{t}</span>
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <fieldset>
                    <legend className="micro mb-3 text-[10px] text-[var(--dim-2)]">Гостей</legend>
                    <div className="flex items-center gap-4">
                      <button type="button" aria-label="Меньше гостей" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="h-11 w-11 rounded-full border border-[var(--hair-strong)] text-xl">−</button>
                      <span className="relative h-12 w-12 overflow-hidden text-center">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={guests}
                            className="display absolute inset-0 flex items-center justify-center text-4xl tabular-nums"
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -30, opacity: 0 }}
                            transition={{ duration: 0.35, ease: EASE }}
                          >
                            {guests}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <button type="button" aria-label="Больше гостей" onClick={() => setGuests((g) => Math.min(30, g + 1))} className="h-11 w-11 rounded-full border border-[var(--hair-strong)] text-xl">+</button>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="micro mb-3 text-[10px] text-[var(--dim-2)]">Зона</legend>
                    <div className="flex flex-wrap gap-2">
                      {booking.zones.map((z) => (
                        <Chip key={z} group="zone" on={z === zone} onClick={() => setZone(z)}>
                          {z}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </LayoutGroup>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <motion.label key={shake} className="block" animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.45 }}>
                  <span className="sr-only">Имя</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя *"
                    autoComplete="given-name"
                    className={`w-full rounded-xl border bg-transparent px-4 py-3.5 outline-none transition-colors placeholder:text-[var(--dim-2)] focus:border-amber ${shake && !name.trim() ? 'border-ember' : 'border-[var(--hair)]'}`}
                  />
                </motion.label>
                <label className="block">
                  <span className="sr-only">Пожелание</span>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Пожелание: день рождения, детский стул…"
                    className="w-full rounded-xl border border-[var(--hair)] bg-transparent px-4 py-3.5 outline-none transition-colors placeholder:text-[var(--dim-2)] focus:border-amber"
                  />
                </label>
              </div>

              {tray.length > 0 && (
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--hair)] px-4 py-3 text-sm">
                  <input type="checkbox" checked={withTray} onChange={(e) => setWithTray(e.target.checked)} className="h-4 w-4 accent-[#ffb561]" />
                  <span>
                    Добавить стол из меню: {trayCount(tray)} поз. · <span className="text-ember">{rub(trayTotal(tray))}</span>
                  </span>
                </label>
              )}

              <button type="submit" data-cursor="Готово" className="group relative mt-7 w-full overflow-hidden rounded-full bg-amber py-4 font-semibold text-ink shadow-[0_0_40px_rgba(255,181,97,0.35)]">
                <span className="relative z-10">Собрать бронь</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>
            </form>

            {/* ── обратная сторона: табличка RESERVED ── */}
            <div
              className="col-start-1 row-start-1 flex min-w-0 flex-col rounded-[28px] border border-amber/40 bg-ink-2 p-[clamp(20px,3vw,40px)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
              aria-hidden={!done}
              inert={!done}
            >
              <div className="flex items-center justify-between">
                <span className="micro text-amber">Почти готово</span>
                <button type="button" onClick={() => setDone(false)} className="micro text-[10px] text-[var(--dim-2)] hover:text-cream">
                  ← Изменить
                </button>
              </div>
              <div className="display neon my-6 text-center text-[clamp(44px,6vw,84px)]">Reserved</div>
              <pre className="no-scrollbar max-h-[260px] flex-1 overflow-auto whitespace-pre-wrap rounded-2xl bg-ink/60 p-5 font-sans text-sm leading-relaxed text-[var(--dim)]" data-lenis-prevent>
                {message}
              </pre>
              <a
                href={whatsappLink(message)}
                target="_blank"
                rel="noreferrer"
                data-cursor="WhatsApp"
                className="mt-6 flex items-center justify-center gap-3 rounded-full bg-[#25d366] py-4 font-semibold text-ink"
              >
                Отправить в WhatsApp
              </a>
              <p className="mt-3 text-center text-xs text-[var(--dim-2)]">Откроется чат администратора {contact.whatsappLabel} с готовым текстом</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
