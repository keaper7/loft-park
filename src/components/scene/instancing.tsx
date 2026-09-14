'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

/** Детерминированный случайный ряд: расстановка не прыгает между загрузками */
export function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** Матрица объекта: позиция, масштаб, поворот вокруг Y (и X) */
export const mat = (p: [number, number, number], s: [number, number, number] = [1, 1, 1], ry = 0, rx = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(...s))

/**
 * Однотипные предметы — инстансами: одна геометрия, много матриц и цветов.
 * Кресла, кашпо, бутылки, лампы — десятки штук за один draw call.
 * Цвет инстанса умножается на цвет материала, поэтому с `colors`
 * материал должен быть белым.
 */
export function Instances({ items, geometry, material, colors }: { items: THREE.Matrix4[]; geometry: THREE.BufferGeometry; material: THREE.Material; colors?: THREE.Color[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((m, i) => mesh.setMatrixAt(i, m))
    colors?.forEach((c, i) => mesh.setColorAt(i, c))
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [items, colors])
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} />
}
