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

/**
 * Ротанг: диагональная плетёнка с просветами. С alphaTest кресла террасы
 * становятся «корзинками», через которые видно подушку и настил, —
 * как настоящие плетёные кресла на фото.
 */
export function weaveTexture(repeat: [number, number] = [6, 2]) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 64, 64)
  const strands = (color: string, width: number, dir: 1 | -1) => {
    g.strokeStyle = color
    g.lineWidth = width
    // шаг 16 px укладывается в тайл 64 px четыре раза — шов не виден
    for (let k = -64; k <= 128; k += 16) {
      g.beginPath()
      g.moveTo(k, 0)
      g.lineTo(k + 64 * dir, 64)
      g.stroke()
    }
  }
  strands('#7d5f3a', 6, 1)
  strands('#c4a274', 5, -1)
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

/**
 * Мягкая тень под мебелью: чёрное пятно, растворяющееся к краям. Настоящие
 * карты теней от десятка ламп сцену бы не потянули, а без затемнения под
 * ножками мебель «висела» над полом.
 */
export function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(0,0,0,0.6)')
  grd.addColorStop(0.5, 'rgba(0,0,0,0.3)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
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

/**
 * Плитка парка «кирпичиком» — как на фото площади: вперемешку
 * красно-коричневые, серые и бежевые брусочки. seed разный у аллеи и
 * площади, чтобы рисунок не повторялся один в один.
 */
export function paversTexture(repeat: [number, number] = [8, 8], seed = 17) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rand(seed)
  g.fillStyle = '#35302c'
  g.fillRect(0, 0, 512, 512)
  const w = 64
  const h = 32
  const palette = [
    [8, 34, 34], // красно-коричневый
    [12, 30, 40],
    [20, 8, 44], // серый
    [30, 14, 52], // бежевый
    [4, 38, 28], // тёмный кирпич
  ]
  for (let row = 0; row * h < 512; row++) {
    const off = row % 2 ? w / 2 : 0
    for (let col = -1; col * w < 512 + w; col++) {
      const [hue, sat, light] = palette[Math.floor(r() * palette.length)]
      g.fillStyle = `hsl(${hue + r() * 6} ${sat + r() * 6}% ${light + r() * 7}%)`
      g.fillRect(col * w + off + 2, row * h + 2, w - 4, h - 4)
    }
  }
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)'
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
  return toTexture(c, repeat)
}

/**
 * Горизонтальные рейки: перегородки террасы и ящики-кашпо. Тёплое
 * коричневое дерево с тёмными щелями между рейками; щели прозрачны,
 * если alpha = true, — сквозь перегородку просвечивает свет.
 */
export function slatsTexture(repeat: [number, number] = [1, 1], alpha = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const r = rand(alpha ? 61 : 67)
  g.clearRect(0, 0, 256, 256)
  if (!alpha) {
    g.fillStyle = '#140c07'
    g.fillRect(0, 0, 256, 256)
  }
  const n = 8
  const step = 256 / n
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(${22 + r() * 6} ${38 + r() * 10}% ${26 + r() * 8}%)`
    g.fillRect(0, i * step, 256, step * 0.72)
    for (let k = 0; k < 8; k++) {
      g.strokeStyle = `rgba(30,15,5,${0.1 + r() * 0.15})`
      g.beginPath()
      const y = i * step + r() * step * 0.7
      g.moveTo(0, y)
      g.lineTo(256, y + r() * 2 - 1)
      g.stroke()
    }
  }
  return toTexture(c, repeat)
}

/** Бетон кашпо: светло-серый, в пятнах и порах */
export function concreteTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const r = rand(71)
  g.fillStyle = '#a7a39b'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 90; i++) {
    const x = r() * 256
    const y = r() * 256
    const rad = 10 + r() * 40
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    const d = r() > 0.5
    grd.addColorStop(0, d ? 'rgba(60,55,50,0.12)' : 'rgba(255,255,250,0.1)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = 'rgba(40,36,32,0.25)'
    g.fillRect(r() * 256, r() * 256, 1, 1)
  }
  return toTexture(c)
}

/**
 * Резная ширма у входа в зал (на фото — светлая фанера с прорезями-листьями).
 * Прорези вырезаны в альфе: с alphaTest сквозь ширму видно зал.
 */
export function carvedScreenTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  const r = rand(91)
  g.fillStyle = '#c9a377'
  g.fillRect(0, 0, 256, 512)
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(120,80,40,${0.08 + r() * 0.1})`
    g.beginPath()
    const x = r() * 256
    g.moveTo(x, 0)
    g.lineTo(x + r() * 10 - 5, 512)
    g.stroke()
  }
  g.globalCompositeOperation = 'destination-out'
  // вытянутые «листья» под разными углами, рядами со сдвигом
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 32 + col * 64 + (row % 2) * 32 + (r() - 0.5) * 10
      const y = 30 + row * 56 + (r() - 0.5) * 10
      g.save()
      g.translate(x, y)
      g.rotate((row % 2 ? 1 : -1) * (0.5 + r() * 0.4))
      g.beginPath()
      g.ellipse(0, 0, 9, 26, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  }
  const tex = toTexture(c)
  return tex
}

/**
 * Подсветка потолочного короба: светлая полоса вдоль каждой кромки, к центру
 * гаснет. Кладётся аддитивно на тёмный потолок — как засветка от LED-ленты.
 */
export function coveGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.globalCompositeOperation = 'lighter'
  // Узкая полоса: на плоскости 22 × 14 м 6% тайла — это ~1 м засветки у кромки.
  // При 25% весь потолок заливало кислотно-зелёным
  const edges: [number, number, number, number][] = [
    [0, 0, 0, 16],
    [0, 256, 0, 240],
    [0, 0, 16, 0],
    [256, 0, 240, 0],
  ]
  for (const [x0, y0, x1, y1] of edges) {
    const grd = g.createLinearGradient(x0, y0, x1, y1)
    grd.addColorStop(0, 'rgba(170,215,110,0.7)')
    grd.addColorStop(1, 'rgba(190,235,120,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
  }
  return toTexture(c)
}

/** Столешницы зала «ёлочкой»: светлый дуб, как на фото у стены из мха */
export function herringboneTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const r = rand(83)
  // тёмные стыки между планками
  g.fillStyle = '#3e2715'
  g.fillRect(0, 0, 256, 256)
  const s = 32
  for (let y = -s; y < 256 + s; y += s / 2) {
    for (let x = 0; x < 256; x += s) {
      const left = (x / s) % 2 === 0
      g.save()
      g.translate(x + s / 2, y)
      g.rotate(left ? Math.PI / 4 : -Math.PI / 4)
      // Медовый дуб под лаком: приглушённее прежнего оранжевого, у каждой
      // планки свой тон, по планке — волокна
      g.fillStyle = `hsl(${29 + r() * 7} ${34 + r() * 12}% ${34 + r() * 12}%)`
      g.fillRect(-s * 0.7, -s * 0.16, s * 1.4, s * 0.3)
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `rgba(${r() < 0.5 ? '40,22,10' : '235,190,130'},${0.08 + r() * 0.1})`
        g.lineWidth = 0.6 + r() * 0.8
        const yy = -s * 0.14 + r() * s * 0.26
        g.beginPath()
        g.moveTo(-s * 0.7, yy)
        g.quadraticCurveTo(0, yy + (r() - 0.5) * 2, s * 0.7, yy + (r() - 0.5) * 1.5)
        g.stroke()
      }
      g.restore()
    }
  }
  return toTexture(c)
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

