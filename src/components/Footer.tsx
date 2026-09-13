'use client'

import { motion } from 'motion/react'
import { brand, contact } from '@/content'
import { OpenStatus } from './OpenStatus'
import { Reveal } from './Reveal'

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * Финал: камера поднимается над парком, сцена становится картой, а над
 * крышей ресторана загорается маяк. Метка «Вы здесь» стоит по центру
 * экрана — туда keyframes.ts кладёт здание на последнем кадре.
 */
export function Footer() {
  return (
    <footer data-cam="11" className="relative flex min-h-[200vh] flex-col justify-end">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center" aria-hidden="true">
        <motion.div
          className="flex -translate-y-[26vh] flex-col-reverse items-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.6 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <span className="glass micro rounded-full px-4 py-2 text-[10px] text-amber">Вы здесь · {brand.name}</span>
          <span className="h-14 w-px bg-gradient-to-t from-amber to-transparent" />
        </motion.div>
      </div>

      {/* pb-28: последняя строка футера должна уезжать выше плавающей плашки «На столе» */}
      <div className="relative bg-gradient-to-t from-ink via-ink/95 to-transparent px-[var(--pad)] pb-28 pt-[20vh]">
        <Reveal>
          <a href="#top" data-cursor="Наверх" className="display neon flicker block text-center text-[clamp(56px,15vw,260px)] leading-[0.8]">
            {brand.name}
          </a>
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-[1320px] gap-10 border-t border-[var(--hair)] pt-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="micro mb-3 text-[10px] text-[var(--dim-2)]">Адрес</p>
            <p className="text-lg">{contact.address}</p>
            <p className="text-[var(--dim)]">{contact.addressNote}</p>
            <a href={contact.yandexMaps} target="_blank" rel="noreferrer" className="micro mt-3 inline-block text-[10px] text-amber">
              Проложить маршрут ↗
            </a>
          </div>
          <div>
            <p className="micro mb-3 text-[10px] text-[var(--dim-2)]">Часы</p>
            <p className="text-lg">{contact.hours.label}</p>
            <OpenStatus className="micro mt-2 text-[10px]" />
          </div>
          <div>
            <p className="micro mb-3 text-[10px] text-[var(--dim-2)]">Связь</p>
            <a href={contact.phoneHref} className="block text-lg hover:text-amber">{contact.phone}</a>
            <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer" className="block text-[var(--dim)] hover:text-amber">
              WhatsApp {contact.whatsappLabel}
            </a>
          </div>
          <div>
            <p className="micro mb-3 text-[10px] text-[var(--dim-2)]">Соцсети</p>
            <a href={brand.instagram} target="_blank" rel="noreferrer" className="text-lg hover:text-amber">
              Instagram {brand.instagramHandle}
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-[1320px] flex-col justify-between gap-3 text-xs text-[var(--dim-2)] md:flex-row">
          <p>Концепт-проект для портфолио. Не официальный сайт ресторана; данные — из открытых источников, 2026.</p>
          <p>Дизайн и разработка — SEVEN · 3D, WebGL, motion</p>
        </div>
      </div>
    </footer>
  )
}
