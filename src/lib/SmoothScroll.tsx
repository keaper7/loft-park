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

    // Параллакс от курсора — только для мыши. На тач-экране pointermove
    // приходит во время свайпа, и камера рывками ездила за пальцем поверх
    // скролла. Проверка та же, что у Cursor и MagneticButton.
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const onMouse = (e: PointerEvent) => {
      scrollState.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      scrollState.mouseY = (e.clientY / window.innerHeight) * 2 - 1
    }
    if (finePointer) window.addEventListener('pointermove', onMouse, { passive: true })

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
        /**
         * На пальце — РОДНАЯ инерция браузера. Lenis сглаживает только колесо.
         *
         * Здесь стояло syncTouch: true, и это была ошибка. С ним Lenis
         * перехватывает touchmove и двигает страницу сам, из JavaScript, в
         * основном потоке, рядом с тяжёлой 3D-сценой. Родная инерция при этом
         * выключена: привычного «провёл пальцем, и страница сама ещё немного
         * проехала» не остаётся, вместо него самодельная имитация, которая на
         * живом телефоне ощущается как рывки.
         *
         * Почему ошибка держалась: замер в headless показывал улучшение на
         * 70%, но синтетические касания CDP не порождают родной инерции
         * вообще. То есть Lenis сравнивался с пустотой, а не с настоящим
         * поведением телефона. На iOS родную прокрутку считает компоновщик,
         * она идёт ровно даже когда основной поток занят, — повторить это
         * из JavaScript нельзя в принципе.
         *
         * ?sync включает старое поведение, если нужно сравнить на устройстве.
         * В headless эту разницу мерить бессмысленно по построению.
         */
        syncTouch: new URLSearchParams(window.location.search).has('sync'),
        autoRaf: false,
      })
      setLenis(lenis)
      // Пока идёт прелоадер, страница стоит: скролл за шторкой сбил бы
      // первый кадр камеры и буквенную анимацию героя.
      if (!useStore.getState().introDone) lenis.stop()
      const unsub = useStore.subscribe((s, prev) => {
        if (s.introDone && !prev.introDone) lenis.start()
      })
      lenis.on('scroll', () => {
        ScrollTrigger.update()
      })
      /**
       * Позицию читаем каждый кадр, а не только по событию scroll.
       *
       * На телефоне Lenis не ведёт тач-скролл (syncTouch: false), страницу
       * двигает сам браузер, а события приходят рвано и пачками: замер
       * показал, что значение обновлялось лишь на 60 кадрах из 473 и
       * скакало сразу на ~45px. Камера получала лестницу вместо плавного
       * значения — отсюда рывки. window.scrollY в кадре — всегда текущее
       * положение страницы; на десктопе это то же значение, которое Lenis
       * сам и выставил, так что инерция колеса не ломается.
       */
      const tick = (time: number) => {
        lenis.raf(time * 1000)
        updateScroll(window.scrollY)
      }
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
