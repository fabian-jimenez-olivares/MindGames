import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GOLD } from './stubs/data/goldRewards'
import { bumpToolUse } from './stubs/hooks/useToolUse'
import { awardGold } from './stubs/hooks/useWallet'
import { readBestSemaforo, saveBestSemaforo } from './stubs/lib/concentracionRecords'
import { writeAppItem } from './stubs/lib/persistGate'
import { getGamified } from './stubs/lib/preferences'

type GameId = 'semaforo' | 'rainmath'

const GAMES: { id: GameId; label: string; accent: string; icon: ReactNode }[] = [
  {
    id: 'semaforo',
    label: 'El Semáforo Loco',
    accent: '#e25b3a',
    icon: (
      <>
        <rect x="8" y="3" width="8" height="18" rx="3" />
        <circle cx="12" cy="8" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="12" cy="16" r="1.7" />
      </>
    ),
  },
  {
    id: 'rainmath',
    label: 'RainMath',
    accent: '#3b82f6',
    icon: (
      <>
        <path d="M12 3v3" />
        <path d="M8 9c0 3 1.8 6 4 8 2.2-2 4-5 4-8" />
        <path d="M9.2 20h5.6" />
      </>
    ),
  },
]

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

type ColorId = 'rojo' | 'verde' | 'amarillo' | 'azul' | 'morado' | 'naranja'
type Prop = 'fondo' | 'colorLetra' | 'palabra'
type Face = { word: ColorId; ink: ColorId; bg: ColorId }
type Rule = { from: Prop; to: Prop; label: string }
type DiffLevel = 1 | 2

const COLORS_1: ColorId[] = ['rojo', 'verde', 'amarillo', 'azul']
const COLORS_2: ColorId[] = ['rojo', 'verde', 'amarillo', 'azul', 'morado', 'naranja']
const DIFF_KEY = 'motivacional.semaforo.difficulty.v1'

const PALETTE: Record<ColorId, { label: string; ink: string; bg: string }> = {
  rojo: { label: 'ROJO', ink: '#b71c1c', bg: '#e53935' },
  verde: { label: 'VERDE', ink: '#22a34a', bg: '#22a34a' },
  amarillo: { label: 'AMARILLO', ink: '#f5c400', bg: '#f5c400' },
  azul: { label: 'AZUL', ink: '#1e3a8a', bg: '#3b82f6' },
  morado: { label: 'MORADO', ink: '#7b1fa2', bg: '#9c27b0' },
  naranja: { label: 'NARANJA', ink: '#e65100', bg: '#ff9800' },
}

function readDiff(): DiffLevel {
  try {
    return localStorage.getItem(DIFF_KEY) === '2' ? 2 : 1
  } catch {
    return 1
  }
}

function writeDiff(level: DiffLevel) {
  writeAppItem(DIFF_KEY, String(level))
}

function colorsFor(level: DiffLevel) {
  return level === 2 ? COLORS_2 : COLORS_1
}

const RULES: Rule[] = [
  { from: 'fondo', to: 'colorLetra', label: 'FONDO => COLOR LETRA' },
  { from: 'fondo', to: 'palabra', label: 'FONDO => PALABRA' },
  { from: 'colorLetra', to: 'palabra', label: 'COLOR LETRA => PALABRA' },
  { from: 'colorLetra', to: 'fondo', label: 'COLOR LETRA => FONDO' },
  { from: 'palabra', to: 'fondo', label: 'PALABRA => FONDO' },
  { from: 'palabra', to: 'colorLetra', label: 'PALABRA => COLOR LETRA' },
]

const RULE_MS = 7000

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function read(face: Face, prop: Prop): ColorId {
  if (prop === 'palabra') return face.word
  if (prop === 'colorLetra') return face.ink
  return face.bg
}

function dealSign(pool: ColorId[]): Face {
  const bg = pick(pool)
  return { word: pick(pool), ink: pick(pool.filter((color) => color !== bg)), bg }
}

function dealPads(pool: ColorId[]): Face[] {
  const words = shuffle(pool)
  const inks = shuffle(pool)
  const bgs = shuffle(pool)
  const pads = words.map((word, index) => ({ word, ink: inks[index], bg: bgs[index] }))
  for (const pad of pads) {
    if (pad.ink !== pad.bg) continue
    const other = pads.find((item) => item !== pad && item.bg !== pad.ink && item.ink !== pad.bg)
    if (!other) continue
    const swap = pad.bg
    pad.bg = other.bg
    other.bg = swap
  }
  return pads
}

function dealRound(pool: ColorId[]) {
  return { sign: dealSign(pool), pads: dealPads(pool) }
}

function nextRule(current: Rule | null) {
  return pick(current ? RULES.filter((rule) => rule.label !== current.label) : RULES)
}

export function SemaforoLoco() {
  const [playing, setPlaying] = useState(false)
  const [level, setLevel] = useState<DiffLevel>(readDiff)
  const [rule, setRule] = useState<Rule>(() => RULES[0])
  const [ruleKey, setRuleKey] = useState(0)
  const [round, setRound] = useState(() => dealRound(colorsFor(readDiff())))
  const [hits, setHits] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(() => readBestSemaforo())
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const pressedRef = useRef(false)
  const hitsRef = useRef(0)
  const recordsRef = useRef(0)
  const bestRef = useRef(best)
  bestRef.current = best

  useEffect(() => {
    return () => {
      const hits = hitsRef.current
      const records = recordsRef.current
      hitsRef.current = 0
      recordsRef.current = 0
      const gold = hits * GOLD.semaforoHit + records * GOLD.semaforoRecord
      if (getGamified() && gold > 0) {
        awardGold(gold, `¡Semáforo Loco! +${gold} de oro 🪙`)
      }
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      if (!pressedRef.current) setStreak(0)
      pressedRef.current = false
      setRule((current) => nextRule(current))
      setRuleKey((key) => key + 1)
    }, RULE_MS)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 280)
    return () => window.clearTimeout(timer)
  }, [flash])

  function start() {
    setPlaying(true)
    setRule(nextRule(null))
    setRuleKey((key) => key + 1)
    setRound(dealRound(colorsFor(level)))
    setHits(0)
    setStreak(0)
    setFlash(null)
    pressedRef.current = false
  }

  function press(index: number) {
    if (!playing) return
    pressedRef.current = true
    const want = read(round.sign, rule.from)
    const correct = round.pads.findIndex((pad) => read(pad, rule.to) === want)
    if (index === correct) {
      setHits((n) => {
        const next = n + 1
        hitsRef.current = next
        return next
      })
      setStreak((n) => {
        const next = n + 1
        if (next > bestRef.current) {
          const saved = saveBestSemaforo(next)
          bestRef.current = saved
          setBest(saved)
          recordsRef.current += 1
        }
        return next
      })
      setFlash('ok')
    } else {
      setStreak(0)
      setFlash('bad')
    }
    setRound(dealRound(colorsFor(level)))
  }

  function cycleLevel() {
    const next: DiffLevel = level === 1 ? 2 : 1
    writeDiff(next)
    setLevel(next)
    setRound(dealRound(colorsFor(next)))
  }

  if (!playing) {
    return (
      <div className="semaforo-game">
        <p className="semaforo-how">
          El cartel central tiene palabra, color de letra y fondo. Cada botón también. Seguí la flecha: izquierda = cartel,
          derecha = botón. La regla cambia cada 7 segundos.
        </p>
        <button type="button" className="primary-btn" onClick={start}>
          Jugar
        </button>
      </div>
    )
  }

  return (
    <div className={`semaforo-game${flash ? ` is-${flash}` : ''}${level === 2 ? ' is-hard' : ''}`}>
      <div className="semaforo-score" aria-live="polite">
        <span>
          <b>{hits}</b> aciertos
        </span>
        <span>
          <b>{streak}</b> racha
        </span>
        <span>
          <b>{best}</b> record
        </span>
        <button type="button" className="semaforo-diff" onClick={cycleLevel}>
          Cambiar Dificultad {level}
        </button>
      </div>
      <p key={ruleKey} className="semaforo-rule">
        {rule.label}
      </p>
      <div key={`bar-${ruleKey}`} className="semaforo-bar" aria-hidden />
      <div className="semaforo-body">
        <div className="semaforo-lamps" aria-hidden>
          <i className="is-rojo" />
          <i className="is-amarillo" />
          <i className="is-verde" />
        </div>
        <div
          className="semaforo-sign"
          style={{ background: PALETTE[round.sign.bg].bg, color: PALETTE[round.sign.ink].ink }}
        >
          {PALETTE[round.sign.word].label}
        </div>
      </div>
      <div className="semaforo-choices">
        {round.pads.map((pad, index) => (
          <button
            key={`${pad.word}-${pad.ink}-${pad.bg}-${index}`}
            type="button"
            className="semaforo-choice"
            style={{ background: PALETTE[pad.bg].bg, color: PALETTE[pad.ink].ink }}
            aria-label={`${PALETTE[pad.word].label}, letra ${pad.ink}, fondo ${pad.bg}`}
            onClick={() => press(index)}
          >
            {PALETTE[pad.word].label}
          </button>
        ))}
      </div>
    </div>
  )
}

