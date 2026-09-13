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
        <div className="relative ml-auto w-full max-w-[720px] px-[var(--pad)] text-right">
          <p className="micro mb-5 text-amber">{nights.eyebrow}</p>
          <SplitText text={nights.title} className="display text-[clamp(40px,6vw,100px)]" />
          <Reveal delay={0.2}>
            <p className="ml-auto mt-7 max-w-[460px] leading-relaxed text-[var(--dim)]">{nights.text}</p>
          </Reveal>

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
