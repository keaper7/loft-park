/**
 * Параметры, которые CameraRig вычисляет из скролла, а остальные объекты
 * сцены читают в своём useFrame: сила bloom, «где сейчас камера»,
 * флаг упрощённого режима. Мутабельный объект — по той же причине,
 * что и scrollState: 60 раз в секунду через React не гоняем.
 */
export const fx = {
  cam: 0,
  bloom: 1,
  reduced: false,
  /** ?snap — камера без сглаживания: для скриншотов и проверки кадров */
  snap: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('snap'),
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const smoothstep = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)))
/** Экспоненциальное сглаживание, не зависящее от частоты кадров */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))
