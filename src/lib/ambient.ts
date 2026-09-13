/**
 * «Атмосфера» без единого аудиофайла — синтез в Web Audio:
 * гул парка (коричневый шум через низкочастотный фильтр), тёплый
 * аккорд-пэд с медленным «дыханием» и тихий бочка-хэт грув в 96 BPM,
 * как DJ за стеной. Включается только по клику: автозвук — дурной тон,
 * да и браузеры его блокируют.
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let nextBeat = 0
let beat = 0

function brownNoise(c: AudioContext) {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function kick(c: AudioContext, out: AudioNode, t: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18)
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.4)
}

function hat(c: AudioContext, out: AudioNode, t: number) {
  const src = c.createBufferSource()
  const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  src.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const g = c.createGain()
  g.gain.setValueAtTime(0.06, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  src.connect(hp).connect(g).connect(out)
  src.start(t)
}

export function startAmbient() {
  if (ctx) {
    ctx.resume()
    master?.gain.cancelScheduledValues(ctx.currentTime)
    master?.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5)
    return
  }
  const c = new AudioContext()
  ctx = c
  master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)
  master.gain.linearRampToValueAtTime(0.5, c.currentTime + 2)

  const noise = brownNoise(c)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  const ng = c.createGain()
  ng.gain.value = 0.12
  noise.connect(lp).connect(ng).connect(master)
  noise.start()

  const pad = c.createGain()
  pad.gain.value = 0.05
  const padLp = c.createBiquadFilter()
  padLp.type = 'lowpass'
  padLp.frequency.value = 900
  pad.connect(padLp).connect(master)
  ;[110, 164.81, 196, 246.94, 329.63].forEach((f, i) => {
    const o = c.createOscillator()
    o.type = i % 2 ? 'triangle' : 'sine'
    o.frequency.value = f
    o.detune.value = (i - 2) * 4
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = 0.07 + i * 0.03
    lg.gain.value = 0.4
    const g = c.createGain()
    g.gain.value = 0.5
    lfo.connect(lg).connect(g.gain)
    o.connect(g).connect(pad)
    o.start()
    lfo.start()
  })

  const drums = c.createGain()
  drums.gain.value = 0.35
  const drumLp = c.createBiquadFilter()
  drumLp.type = 'lowpass'
  drumLp.frequency.value = 2400 // «за стеной»
  drums.connect(drumLp).connect(master)

  const spb = 60 / 96 / 2
  nextBeat = c.currentTime + 0.1
  beat = 0
  timer = setInterval(() => {
    while (nextBeat < c.currentTime + 0.2) {
      if (beat % 2 === 0) kick(c, drums, nextBeat)
      else hat(c, drums, nextBeat)
      nextBeat += spb
      beat++
    }
  }, 50)
}

export function stopAmbient() {
  if (!ctx || !master) return
  const c = ctx
  master.gain.cancelScheduledValues(c.currentTime)
  master.gain.setValueAtTime(master.gain.value, c.currentTime)
  master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8)
  setTimeout(() => {
    if (timer) clearInterval(timer)
    timer = null
    c.close()
    if (ctx === c) {
      ctx = null
      master = null
    }
  }, 900)
}
