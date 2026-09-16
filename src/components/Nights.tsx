'use client'

import { motion } from 'motion/react'
import { nights } from '@/content'
import { SplitText } from './SplitText'
import { Reveal } from './Reveal'
import { SoundToggle } from './SoundToggle'

const EASE = [0.16, 1, 0.3, 1] as const

export function Nights() {
  return (
    <section id="nights" data-cam="8" className="relative flex min-h-[190vh] items-center">
      <div className="sticky top-0 flex h-[100svh] w-full items-center">
        <div className="scrim-r absolute inset-0" />
        {/* 820, а не 720: отступы --pad растут до 88px, и на широком экране
            место под текст внутри колонки съёживалось (512 → 464px), пока
            шрифт по 5.4vw только рос. Более широкая колонка позволяет
            оставить заголовок крупным, не упираясь словом в край карточки */}
        <div className="relative ml-auto w-full max-w-[820px] px-[var(--pad)] text-right">
          {/* Камера кадра 8 смотрит прямо на неоновую вывеску LOFT · PARK на
              стене из мха — один только scrim-r к середине экрана почти
              гаснет, и вывеска с bloom светила прямо сквозь заголовок и
              абзац на любой ширине экрана. Плашка .glass — тот же приём,
              что уже работает у карточек фактов и пилюли звука ниже. */}
          <div className="flex justify-end">
            <div className="glass max-w-full rounded-[28px] px-[clamp(20px,4vw,40px)] py-[clamp(18px,3.2vw,34px)] text-right">
              <p className="micro mb-5 text-amber">{nights.eyebrow}</p>
              {/* «НАБИРАЕТ» — самое длинное слово, его ширина ≈ 7.1 × размер
                  шрифта. Потолок 74px держит его в 524px при самой узкой
                  коробке (564px на 1920+), нижние 30px — под экран 320px */}
              <SplitText text={nights.title} className="display text-[clamp(30px,5.4vw,74px)]" />
              <Reveal delay={0.2}>
                <p className="ml-auto mt-7 max-w-[460px] leading-relaxed text-[var(--dim)]">{nights.text}</p>
              </Reveal>
            </div>
          </div>

          <ul className="mt-10 grid grid-cols-2 gap-3">
            {nights.facts.map((f, i) => (
              <motion.li
                key={f.k}
                className="glass rounded-2xl p-5 text-left"
                initial={{ opacity: 0, y: 40, rotateX: -30 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.08 }}
                style={{ transformPerspective: 700 }}
              >
                <span className="display neon block text-[clamp(26px,3vw,44px)]">{f.k}</span>
                <span className="micro mt-2 block text-[10px] text-[var(--dim-2)]">{f.v}</span>
              </motion.li>
            ))}
          </ul>

          <Reveal delay={0.4} className="mt-8 flex justify-end">
            <div className="glass inline-flex rounded-full px-5 py-3">
              <SoundToggle withLabel />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
