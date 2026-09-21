'use client'

import { animate, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { contact, rating } from '@/content'

const EASE = [0.16, 1, 0.3, 1] as const
const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z'

/**
 * Рейтинг — только цифры из Яндекс Карт со ссылкой на источник.
 * Цитат отзывов нет намеренно: выдуманный отзыв на концепте выглядел бы
 * как подделка, а копировать настоящие без спроса нельзя.
 */
export function Rating() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [value, setValue] = useState(0)
  const [ratings, setRatings] = useState(0)

  useEffect(() => {
    if (!inView) return
    const a = animate(0, rating.value, { duration: 2, ease: EASE, onUpdate: setValue })
    const b = animate(0, rating.ratings, { duration: 2.4, ease: EASE, onUpdate: (v) => setRatings(Math.round(v)) })
    return () => {
      a.stop()
      b.stop()
    }
  }, [inView])

  return (
    <section className="relative px-[var(--pad)] py-[16vh]">
      {/* Подложка нужна: текст здесь стоит по центру поверх сцены, а боковой
          .scrim рассчитан на колонку у края и центр не закрывает. На телефоне
          подпись «Гости говорят цифрами» тонула в фонарях над террасой. */}
      <div className="scrim-c pointer-events-none absolute inset-0" />
      {/* relative обязателен: шторка выше — absolute, а абсолютный элемент
          рисуется поверх непозиционированных соседей. Без него подложка
          легла НА текст, и «5,0» с подписью стали серыми вместо подсветки.
          В Chapter.tsx то же самое сделано так же — там relative стоит. */}
      <div ref={ref} className="relative mx-auto flex max-w-[1100px] flex-col items-center text-center">
        <p className="micro mb-6 text-amber">Гости говорят цифрами</p>
        <div className="display neon text-[clamp(120px,24vw,360px)] leading-[0.8] tabular-nums">{value.toFixed(1).replace('.', ',')}</div>
        <div className="mt-8 flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} viewBox="0 0 24 24" className="h-[clamp(28px,3vw,44px)] w-[clamp(28px,3vw,44px)] overflow-visible">
              {/* ореол — широкий полупрозрачный контур, а не filter: drop-shadow */}
              <motion.path
                d={STAR}
                fill="none"
                stroke="#ffb561"
                strokeWidth="5"
                strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 0.22 } : undefined}
                transition={{ duration: 0.8, delay: 1.1 + i * 0.15 }}
              />
              <motion.path
                d={STAR}
                fill="none"
                stroke="#ffb561"
                strokeWidth="1.3"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.15, ease: EASE }}
              />
              <motion.path
                d={STAR}
                fill="#ffb561"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={inView ? { opacity: 1, scale: 1 } : undefined}
                transition={{ duration: 0.6, delay: 1 + i * 0.15, ease: EASE }}
                style={{ transformOrigin: 'center' }}
              />
            </svg>
          ))}
        </div>
        <p className="mt-8 text-[clamp(18px,1.6vw,24px)] text-[var(--dim)]">
          {/* ширина числа фиксирована: строка не прыгает, пока бежит счётчик */}
          <span className="inline-block min-w-[5ch] text-right tabular-nums text-cream">{ratings.toLocaleString('ru-RU')}</span> оценки и {rating.reviews.toLocaleString('ru-RU')} отзывов
          на Яндекс Картах ·{' '}
          {/* неразрывно: иначе «₽» отрывался на третью строку один */}
          <span className="whitespace-nowrap">средний чек {rating.averageCheck}</span>
        </p>
        <a href={contact.yandexMaps} target="_blank" rel="noreferrer" data-cursor="Открыть" className="micro mt-6 border-b border-amber/50 pb-1 text-amber">
          Проверить на Яндекс Картах ↗
        </a>
      </div>
    </section>
  )
}
