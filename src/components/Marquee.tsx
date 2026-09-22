'use client'

import { motion, useAnimationFrame, useInView, useMotionValue, useScroll, useSpring, useTransform, useVelocity } from 'motion/react'
import { useRef } from 'react'
import { marquee } from '@/content'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

function wrap(min: number, max: number, v: number) {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

/**
 * Две ленты навстречу друг другу, скорость и направление — от скролла.
 * Нижняя наклонена: как две полосы скотча на кирпичной стене.
 */
function Row({ dir, tilt, serif }: { dir: 1 | -1; tilt: number; serif?: boolean }) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // за экраном лента стоит: иначе широкий слой перерисовывался бы всё время
  const visible = useInView(ref, { margin: '200px 0px' })
  const base = useMotionValue(0)
  const { scrollY } = useScroll()
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  /**
   * Множитель скорости ОГРАНИЧЕН (clamp по умолчанию), и диапазон уже.
   *
   * Было [-4, 4] с clamp: false — то есть ничем не ограничено. На телефоне
   * шаг прокрутки доходит до 45 точек за кадр (~2700 точек в секунду), а на
   * флике и вдвое больше, и множитель улетал за 10×. Замер сдвига ленты
   * покадрово, пока она на экране: при медленной прокрутке шаг ровный
   * (неровность 0.09, разброс 1.96…4.03), при быстрой — 1.95…21.09 и
   * неровность 0.38 и 0.48 на двух лентах. Лента то почти стоит, то летит:
   * это и читалось как дёрганье. Потолок 2.2 оставляет заметную реакцию на
   * скролл (до 3.2× базовой скорости), но убирает выброс.
   */
  const factor = useTransform(vel, [-1500, 1500], [-2.2, 2.2])

  useAnimationFrame((_, delta) => {
    if (reduced || !visible) return
    // delta сверху ограничена: один пропущенный кадр не должен давать
    // двойной шаг — иначе просадка сама превращается в рывок ленты
    const dt = Math.min(delta, 32)
    const f = factor.get()
    base.set(base.get() + dir * -1.2 * (dt / 1000) * (1 + Math.abs(f)))
  })
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`)

  const items = (
    <span className="flex shrink-0 items-center">
      {marquee.map((w, i) => (
        <span key={i} className="flex items-center">
          <span className={serif ? 'serif px-6 text-[clamp(44px,7vw,120px)] text-amber' : 'display px-6 text-[clamp(44px,7vw,120px)]'}>{w}</span>
          <span className="h-3 w-3 rotate-45 bg-ember" />
        </span>
      ))}
    </span>
  )

  return (
    <div ref={ref} className="overflow-hidden py-3" style={{ transform: `rotate(${tilt}deg)` }}>
      <motion.div className="flex w-max" style={{ x }}>
        {items}
        {items}
        {items}
        {items}
      </motion.div>
    </div>
  )
}

export function Marquee() {
  return (
    <div aria-hidden="true" className="relative -my-10 overflow-hidden bg-ink py-16">
      <div className="border-y border-[var(--hair)] bg-brick/30">
        <Row dir={1} tilt={0} />
      </div>
      <div className="-mt-2 border-y border-[var(--hair)] bg-ink">
        <Row dir={-1} tilt={-2} serif />
      </div>
    </div>
  )
}
