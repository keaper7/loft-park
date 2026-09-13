import * as THREE from 'three'

/**
 * Процедурные текстуры на canvas. Ни одного файла: кирпич, доски,
 * пятна света и винил рисуются при старте сцены. Это и вес (0 КБ
 * картинок), и честность концепта — никаких чужих фото и сканов.
 */

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function toTexture(canvas: HTMLCanvasElement, repeat?: [number, number], srgb = true) {
  const tex = new THREE.CanvasTexture(canvas)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
  }
  return tex
}

/** Старый кирпич: неровный цвет, тёмные швы, сколы-крапины */
export function brickTexture(repeat: [number, number] = [4, 2]) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(7)
  g.fillStyle = '#2a1a13'
  g.fillRect(0, 0, 512, 512)
  const bw = 64
  const bh = 26
  const mortar = 4
  for (let row = 0; row * bh < 512; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let col = -1; col * bw < 512 + bw; col++) {
      const x = col * bw + off
      const y = row * bh
      const hue = 12 + r() * 10
      const light = 22 + r() * 16
      g.fillStyle = `hsl(${hue} ${38 + r() * 18}% ${light}%)`
      g.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar)
      // сажа и выцветание по краям кирпича
      const grd = g.createLinearGradient(x, y, x, y + bh)
      grd.addColorStop(0, 'rgba(255,220,190,0.06)')
      grd.addColorStop(1, 'rgba(0,0,0,0.25)')
      g.fillStyle = grd
      g.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar)
    }
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,230,200,0.05)'
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
  return toTexture(c, repeat)
}

/** Тёмные дубовые доски пола */
export function woodTexture(repeat: [number, number] = [6, 6]) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(3)
  const pw = 64
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(${24 + r() * 8} ${30 + r() * 10}% ${11 + r() * 6}%)`
    g.fillRect(i * pw, 0, pw, 512)
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`
      g.lineWidth = 1
      g.beginPath()
      const x = i * pw + r() * pw
      g.moveTo(x, 0)
      g.bezierCurveTo(x + r() * 6 - 3, 170, x + r() * 6 - 3, 340, x + r() * 4 - 2, 512)
      g.stroke()
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'
    g.fillRect(i * pw, 0, 2, 512)
    g.fillRect(i * pw, r() * 512, pw, 2)
  }
  return toTexture(c, repeat)
}

/** Мягкое пятно света — «лужа» под фонарём, аддитивно */
export function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grd.addColorStop(0, 'rgba(255,190,110,0.9)')
  grd.addColorStop(0.35, 'rgba(255,150,70,0.35)')
  grd.addColorStop(1, 'rgba(255,120,40,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  return toTexture(c)
}

/** Винил: дорожки, блик и янтарный центр с надписью */
export function vinylTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#060606'
  g.fillRect(0, 0, 512, 512)
  for (let rad = 250; rad > 90; rad -= 2) {
    g.strokeStyle = rad % 6 === 0 ? '#1b1b1b' : '#0d0d0d'
    g.beginPath()
    g.arc(256, 256, rad, 0, Math.PI * 2)
    g.stroke()
  }
  g.fillStyle = '#ffb561'
  g.beginPath()
  g.arc(256, 256, 84, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#0c0a08'
  g.font = '700 30px Unbounded, sans-serif'
  g.textAlign = 'center'
  g.fillText('LOFT', 256, 250)
  g.font = '500 16px Unbounded, sans-serif'
  g.fillText('PARK · SIDE A', 256, 280)
  g.beginPath()
  g.arc(256, 256, 6, 0, Math.PI * 2)
  g.fill()
  return toTexture(c)
}

/** Площадь перед лофтом: бетонная плитка «кирпичиком», серо-розовая */
export function paversTexture(repeat: [number, number] = [8, 8]) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(17)
  g.fillStyle = '#2b2624'
  g.fillRect(0, 0, 512, 512)
  const w = 64
  const h = 32
  for (let row = 0; row * h < 512; row++) {
    const off = row % 2 ? w / 2 : 0
    for (let col = -1; col * w < 512 + w; col++) {
      const l = 30 + r() * 12
      g.fillStyle = `hsl(${8 + r() * 14} ${10 + r() * 12}% ${l}%)`
      g.fillRect(col * w + off + 2, row * h + 2, w - 4, h - 4)
    }
  }
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)'
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
  return toTexture(c, repeat)
}

/** Светлые доски: потолок зала и настил террасы */
export function planksTexture(repeat: [number, number] = [4, 4], light = true) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(light ? 31 : 37)
  const ph = 40
  for (let i = 0; i * ph < 512; i++) {
    const base = light ? 62 + r() * 10 : 26 + r() * 8
    g.fillStyle = `hsl(${28 + r() * 6} ${light ? 22 : 30}% ${base}%)`
    g.fillRect(0, i * ph, 512, ph)
    for (let k = 0; k < 18; k++) {
      g.strokeStyle = `rgba(60,35,20,${0.05 + r() * 0.08})`
      g.beginPath()
      const y = i * ph + r() * ph
      g.moveTo(0, y)
      g.bezierCurveTo(170, y + r() * 4 - 2, 340, y + r() * 4 - 2, 512, y + r() * 3)
      g.stroke()
    }
    g.fillStyle = 'rgba(20,10,5,0.55)'
    g.fillRect(0, i * ph, 512, 2)
  }
  return toTexture(c, repeat)
}

/** Живая стена из мха: пятна разной зелени, мелкая «пористость» */
export function mossTexture(repeat: [number, number] = [3, 1.5]) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(53)
  g.fillStyle = '#1f3a1a'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2600; i++) {
    const x = r() * 512
    const y = r() * 512
    const rad = 3 + r() * 14
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    const hue = 85 + r() * 40
    grd.addColorStop(0, `hsla(${hue} ${45 + r() * 25}% ${22 + r() * 22}% / 0.9)`)
    grd.addColorStop(1, 'hsla(100 40% 12% / 0)')
    g.fillStyle = grd
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
  return toTexture(c, repeat)
}

/** Мелкая подпись на постаменте букв: «BAR & KITCHEN», «TERRACE» */
export function labelTexture(text: string, w = 512, h = 96) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#0b0b0c'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#f4f1ea'
  g.font = `600 ${Math.round(h * 0.42)}px Unbounded, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2)
  return toTexture(c)
}

/** Неоновая вывеска над входом. Шрифт — тот же, что на сайте */
export function signTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1024, 256)
  g.font = '800 150px Unbounded, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = '#ff9a3d'
  g.shadowBlur = 40
  g.fillStyle = '#ffe2b8'
  g.fillText(text, 512, 132)
  g.shadowBlur = 12
  g.fillText(text, 512, 132)
  return toTexture(c)
}
