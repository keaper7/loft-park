'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { veranda } from '@/content'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { SplitText } from './SplitText'

gsap.registerPlugin(ScrollTrigger)

/** Сгенерированные «кадры» веранды: SVG + CSS, без фотографий */
function FrameArt({ i }: { i: number }) {
  if (i === 0)
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1630" />
            <stop offset="0.55" stopColor="#d9652b" />
            <stop offset="1" stopColor="#ffcf7a" />
          </linearGradient>
        </defs>
        <rect width="400" height="500" fill="url(#sun)" />
        <circle cx="200" cy="330" r="70" fill="#ffe2a8" opacity="0.9" className="art-breathe" />
        {Array.from({ length: 14 }, (_, k) => (
          <ellipse key={k} cx={k * 32 - 10} cy={390 + (k % 3) * 10} rx={34 + (k % 4) * 8} ry={60 + (k % 3) * 16} fill="#140c0c" />
        ))}
        <rect y="430" width="400" height="70" fill="#0e0808" />
      </svg>
    )
  if (i === 1)
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <rect width="400" height="500" fill="#0d0b14" />
        {[80, 170, 260].map((y, r) => (
          <g key={y}>
            <path d={`M-20 ${y} Q200 ${y + 90} 420 ${y}`} stroke="#222" strokeWidth="2" fill="none" />
            {Array.from({ length: 11 }, (_, k) => {
              const t = k / 10
              const x = -20 + 440 * t
              const yy = y + 180 * t * (1 - t)
              // ореол — второй круг, а не filter: drop-shadow на мерцающих элементах
              return (
                <g key={k} className="art-twinkle" style={{ animationDelay: `${(k + r * 3) * 0.17}s` }}>
                  <circle cx={x} cy={yy + 8} r="15" fill="#ffb561" opacity="0.22" />
                  <circle cx={x} cy={yy + 8} r="6" fill="#ffc46b" />
                </g>
              )
            })}
          </g>
        ))}
        <rect y="400" width="400" height="100" fill="#1b120c" />
      </svg>
    )
  if (i === 2)
    return (
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <rect width="400" height="500" fill="#10140f" />
        <circle cx="120" cy="120" r="140" fill="#9fb58a" opacity="0.12" />
        {[130, 270].map((x, k) => (
          <g key={x}>
            <path d={`M${x - 55} 150 L${x + 55} 150 L${x + 45} 400 Q${x} 420 ${x - 45} 400 Z`} fill={k ? '#f7c948' : '#e85d75'} opacity="0.55" />
            <path d={`M${x - 55} 150 L${x + 55} 150 L${x + 45} 400 Q${x} 420 ${x - 45} 400 Z`} fill="none" stroke="#fff4e0" strokeOpacity="0.5" strokeWidth="3" />
            {Array.from({ length: 7 }, (_, b) => (
              <circle key={b} cx={x - 30 + ((b * 23) % 60)} cy={380} r={3 + (b % 3)} fill="#fff" opacity="0.7" className="art-bubble" style={{ animationDelay: `${b * 0.4 + k}s` }} />
            ))}
            <circle cx={x + 30} cy={170} r="22" fill="#b6e36b" opacity="0.8" />
          </g>
        ))}
        <rect y="410" width="400" height="90" fill="#2a1a12" />
      </svg>
    )
  if (i === 3)
    return (
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 60% at 50% 100%, #ff6a1f 0%, #7a1d08 35%, #140806 75%)' }}>
        {Array.from({ length: 40 }, (_, k) => (
          <span
            key={k}
            className="art-ember absolute bottom-[10%] block h-1.5 w-1.5 rounded-full bg-[#ffb561]"
            style={{ left: `${(k * 37) % 100}%`, animationDelay: `${(k * 0.23) % 4}s`, animationDuration: `${3 + (k % 5) * 0.6}s`, boxShadow: '0 0 10px #ff8a3d' }}
          />
        ))}
        <div className="absolute inset-x-[12%] bottom-[16%] h-3 rounded-full bg-[#1a1a1a]" />
        {[0, 1, 2, 3, 4].map((k) => (
          <div key={k} className="absolute bottom-[17%] h-1 rounded-full bg-[#9a9a9a]" style={{ left: `${16 + k * 15}%`, width: '12%', transform: `rotate(${k % 2 ? 4 : -3}deg)` }} />
        ))}
      </div>
    )
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <rect width="400" height="500" fill="#06070d" />
      {Array.from({ length: 70 }, (_, k) => (
        <circle key={k} cx={(k * 97) % 400} cy={(k * 53) % 330} r={(k % 3) * 0.6 + 0.6} fill="#fff" className="art-twinkle" style={{ animationDelay: `${(k % 9) * 0.3}s` }} />
      ))}
      <circle cx="300" cy="110" r="46" fill="#f4eadb" />
      <circle cx="320" cy="98" r="44" fill="#06070d" />
      <rect y="380" width="400" height="120" fill="#140e0a" />
      {Array.from({ length: 6 }, (_, k) => (
        <rect key={k} x={30 + k * 62} y="350" width="34" height="30" rx="3" fill="#ffb561" opacity="0.85" className="art-breathe" style={{ animationDelay: `${k * 0.5}s` }} />
      ))}
    </svg>
  )
}

/**
 * Веранда — горизонтальная лента кадров. На десктопе секция закрепляется
 * (GSAP ScrollTrigger pin), и вертикальный скролл двигает ленту вбок.
 * На телефоне и при reduced-motion — обычная лента со свайпом: подмена
 * направления скролла на тач-экране путает больше, чем радует.
 */
export function Veranda() {
  const section = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const desktop = useMediaQuery('(min-width: 900px)')
  const reduced = usePrefersReducedMotion()
  const pinned = desktop && !reduced

  useEffect(() => {
    if (!pinned || !section.current || !track.current) return
    const ctx = gsap.context(() => {
      const distance = () => track.current!.scrollWidth - window.innerWidth
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true,
        },
      })
      gsap.utils.toArray<HTMLElement>('[data-frame]').forEach((el) => {
        gsap.fromTo(
          el.querySelector('[data-art]'),
          { scale: 1.25, xPercent: -8 },
          { scale: 1, xPercent: 8, ease: 'none', scrollTrigger: { trigger: el, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } },
        )
      })
    }, section)
    return () => ctx.revert()
  }, [pinned])

  return (
    <div data-cam="9" id="veranda">
      <section ref={section} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-16">
        <div className="px-[var(--pad)]">
          <p className="micro mb-4 text-amber">{veranda.eyebrow}</p>
          {/* 32px снизу, а не 38: на экране 320px «ОТКРЫТЫМ» при 38px
              занимало 295px в колонке шириной 280 и вылезало за край */}
          <SplitText text={veranda.title} className="display text-[clamp(32px,5.5vw,92px)]" />
        </div>
        <div
          ref={track}
          className={`mt-10 flex gap-[clamp(14px,2vw,28px)] px-[var(--pad)] ${pinned ? 'w-max' : 'no-scrollbar snap-x snap-mandatory overflow-x-auto'}`}
        >
          {veranda.frames.map((f, i) => (
            <figure
              key={f.title}
              data-frame
              data-cursor="Веранда"
              className="group relative h-[min(62vh,560px)] w-[min(78vw,440px)] shrink-0 snap-center overflow-hidden rounded-[22px] border border-[var(--hair)]"
            >
              <div data-art className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                <FrameArt i={i} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6">
                <span className="micro text-[10px] text-amber">0{i + 1}</span>
                <span className="display mt-2 block text-2xl">{f.title}</span>
                <span className="mt-1 block text-sm text-[var(--dim)]">{f.caption}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <style>{`
          @keyframes art-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
          @keyframes art-breathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
          @keyframes art-bubble{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-220px);opacity:0}}
          @keyframes art-ember{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(30px,-60vh);opacity:0}}
          .art-twinkle{animation:art-twinkle 2.4s ease-in-out infinite}
          .art-breathe{animation:art-breathe 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
          .art-bubble{animation:art-bubble 3.2s ease-in infinite}
          .art-ember{animation:art-ember 4s linear infinite}
          @media (prefers-reduced-motion: reduce){.art-twinkle,.art-breathe,.art-bubble,.art-ember{animation:none}}
        `}</style>
      </section>
    </div>
  )
}
