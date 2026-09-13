'use client'

import { create } from 'zustand'

/**
 * UI-состояние, которое делят разные части страницы:
 * - «стол» — предзаказ из меню, уходит в сообщение брони;
 * - готовность сцены — прелоадер не уходит, пока канвас не отрисовал кадр;
 * - звук — эмбиент включается только по явному клику.
 */
export type TrayItem = { key: string; name: string; price: number; qty: number }

type State = {
  tray: TrayItem[]
  add: (name: string, price: number) => void
  change: (key: string, delta: number) => void
  clear: () => void
  sceneReady: boolean
  setSceneReady: () => void
  introDone: boolean
  setIntroDone: () => void
  sound: boolean
  toggleSound: () => void
}

const keyOf = (name: string, price: number) => `${name}·${price}`

export const useStore = create<State>((set) => ({
  tray: [],
  add: (name, price) =>
    set((s) => {
      const key = keyOf(name, price)
      const found = s.tray.find((i) => i.key === key)
      if (found) return { tray: s.tray.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)) }
      return { tray: [...s.tray, { key, name, price, qty: 1 }] }
    }),
  change: (key, delta) =>
    set((s) => ({
      tray: s.tray.map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0),
    })),
  clear: () => set({ tray: [] }),
  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),
  introDone: false,
  setIntroDone: () => set({ introDone: true }),
  sound: false,
  toggleSound: () => set((s) => ({ sound: !s.sound })),
}))

export const trayTotal = (tray: TrayItem[]) => tray.reduce((sum, i) => sum + i.price * i.qty, 0)
export const trayCount = (tray: TrayItem[]) => tray.reduce((sum, i) => sum + i.qty, 0)

export const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`
