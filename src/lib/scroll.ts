import type Lenis from 'lenis'

/**
 * Общее состояние скролла и курсора — обычный мутабельный объект, а не
 * React-стейт. Его читают каждый кадр и 3D-сцена (useFrame), и индикатор
 * прогресса; прогонять 60 обновлений в секунду через ререндеры React
 * было бы дорого и бессмысленно.
 *
 * `cam` — непрерывный номер «кадра» камеры: 0 — герой, 1 — аллея, …
 * Считается по DOM-маркерам `data-cam="N"`: когда центр маркера
 * проходит через центр экрана, cam ровно равен N, между маркерами —
 * линейно. Так 3D-сцена привязана к вёрстке, а не к процентам страницы,
 * и не разъезжается, когда секция меню выросла или сжалась.
 */
export const scrollState = {
  y: 0,
  progress: 0,
  velocity: 0,
  cam: 0,
  mouseX: 0,
  mouseY: 0,
}

type Marker = { at: number; cam: number }
let markers: Marker[] = []

export function measureMarkers() {
  const vh = window.innerHeight
  const found = Array.from(document.querySelectorAll<HTMLElement>('[data-cam]')).map((el) => {
    const r = el.getBoundingClientRect()
    return {
      cam: Number(el.dataset.cam),
      at: Math.max(0, r.top + window.scrollY + r.height / 2 - vh / 2),
    }
  })
  markers = found.sort((a, b) => a.cam - b.cam)
  // Позиции должны расти монотонно, иначе интерполяция развернётся назад
  for (let i = 1; i < markers.length; i++) {
    if (markers[i].at <= markers[i - 1].at) markers[i].at = markers[i - 1].at + 1
  }
}

export function camFromScroll(y: number): number {
  if (markers.length === 0) return 0
  if (y <= markers[0].at) return markers[0].cam
  for (let i = 1; i < markers.length; i++) {
    const a = markers[i - 1]
    const b = markers[i]
    if (y <= b.at) return a.cam + ((y - a.at) / (b.at - a.at)) * (b.cam - a.cam)
  }
  return markers[markers.length - 1].cam
}

export function updateScroll(y: number) {
  const max = document.documentElement.scrollHeight - window.innerHeight
  scrollState.velocity = y - scrollState.y
  scrollState.y = y
  scrollState.progress = max > 0 ? y / max : 0
  scrollState.cam = camFromScroll(y)
}

let lenisRef: Lenis | null = null
export const setLenis = (l: Lenis | null) => {
  lenisRef = l
}
export const getLenis = () => lenisRef

export function scrollToTarget(selector: string) {
  const target = document.querySelector<HTMLElement>(selector)
  if (!target) return
  if (lenisRef) lenisRef.scrollTo(target, { offset: 0, duration: 1.6 })
  else target.scrollIntoView({ behavior: 'auto' })
}
