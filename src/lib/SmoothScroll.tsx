'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { measureMarkers, scrollState, setLenis, updateScroll } from './scroll'
import { useStore } from './store'

gsap.registerPlugin(ScrollTrigger)

/**
 * Инерционный скролл + единый такт для GSAP и Lenis.
 *
 * Lenis крутится внутри gsap.ticker, а не в своём rAF: иначе закреплённая
 * горизонтальная лента веранды (ScrollTrigger) отставала бы от скролла на
 * кадр и дрожала. При prefers-reduced-motion Lenis не включается —
 * состояние скролла тогда читается из нативного события.
 */
export function SmoothScroll() {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const remeasure = () => {
      measureMarkers()
      updateScroll(window.scrollY)
      ScrollTrigger.refresh()
    }
    // refresh перестраивает закреплённую ленту веранды — если звать его на
    // каждое изменение высоты (фильтр меню, подгрузка шрифта), лента дёргалась.
    // Ждём, пока размеры успокоятся, и пересчитываем только при реальной смене.
    let timer = 0
    let lastW = 0
    let lastH = 0
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (Math.abs(width - lastW) < 1 && Math.abs(height - lastH) < 1) return
      lastW = width
      lastH = height
      window.clearTimeout(timer)
      timer = window.setTimeout(remeasure, 150)
    })
    ro.observe(document.body)
    document.fonts?.ready.then(remeasure)
    remeasure()

    const onMouse = (e: PointerEvent) => {
      scrollState.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      scrollState.mouseY = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMouse, { passive: true })

    let cleanup: () => void

    if (reduced) {
      const onScroll = () => {
        updateScroll(window.scrollY)
        ScrollTrigger.update()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      cleanup = () => window.removeEventListener('scroll', onScroll)
    } else {
      const lenis = new Lenis({
        duration: 1.25,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      })
      setLenis(lenis)
      // Пока идёт прелоадер, страница стоит: скролл за шторкой сбил бы
      // первый кадр камеры и буквенную анимацию героя.
      if (!useStore.getState().introDone) lenis.stop()
      const unsub = useStore.subscribe((s, prev) => {
        if (s.introDone && !prev.introDone) lenis.start()
      })
      lenis.on('scroll', ({ scroll }: { scroll: number }) => {
        updateScroll(scroll)
        ScrollTrigger.update()
      })
      const tick = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)

      const onClick = (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]')
        if (!(anchor instanceof HTMLAnchorElement)) return
        if (anchor.dataset.native !== undefined) return
        const id = anchor.getAttribute('href')
        if (!id || id === '#') return
        const target = document.querySelector(id)
        if (!target) return
        e.preventDefault()
        lenis.scrollTo(target as HTMLElement, { duration: 1.8 })
      }
      document.addEventListener('click', onClick)

      cleanup = () => {
        unsub()
        document.removeEventListener('click', onClick)
        gsap.ticker.remove(tick)
        lenis.destroy()
        setLenis(null)
      }
    }

    return () => {
      window.clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('pointermove', onMouse)
      cleanup()
    }
  }, [reduced])

  return null
}
