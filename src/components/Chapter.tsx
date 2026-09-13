'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { SplitText } from './SplitText'
import { Reveal } from './Reveal'

/**
 * Глава путешествия: высокая секция, текст закреплён по центру экрана,
 * пока камера проезжает свой отрезок. Центр секции = маркер data-cam,
 * то есть камера «встаёт» в кадр ровно тогда, когда текст в центре.
 */
export function Chapter({
  id,
  cam,
  align,
  eyebrow,
  title,
  text,
}: {
  id?: string
  cam: number
  align: 'left' | 'right'
  eyebrow: string
  title: string
  text: string
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0.18, 0.35, 0.65, 0.82], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.18, 0.82], [80, -80])
  const line = useTransform(scrollYProgress, [0.25, 0.5], [0, 1])

  return (
    <section id={id} ref={ref} data-cam={cam} className="relative h-[170vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className={`absolute inset-0 ${align === 'left' ? 'scrim' : 'scrim-r'}`} />
        <motion.div
          className={`relative w-full px-[var(--pad)] ${align === 'right' ? 'flex justify-end text-right' : ''}`}
          style={{ opacity, y }}
        >
          <div className="max-w-[640px]">
            <p className="micro mb-5 flex items-center gap-3 text-amber" style={{ justifyContent: align === 'right' ? 'flex-end' : undefined }}>
              <motion.span className="inline-block h-px w-12 origin-left bg-amber" style={{ scaleX: line }} />
              {eyebrow}
            </p>
            {/* Нижняя граница 30px: слова не переносятся внутри себя, и
                «ВСТРЕЧАЮТ» шрифтом Unbounded на 40px не влезал в телефон */}
            <SplitText text={title} className="display text-[clamp(30px,6vw,96px)]" />
            <Reveal delay={0.25}>
              <p className="mt-7 text-[clamp(16px,1.3vw,20px)] leading-relaxed text-[var(--dim)]">{text}</p>
            </Reveal>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
