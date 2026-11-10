import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GOLD } from './stubs/data/goldRewards'
import { awardGold } from './stubs/hooks/useWallet'
import { readBestRainMath, saveBestRainMath } from './stubs/lib/concentracionRecords'
import { getGamified } from './stubs/lib/preferences'

type Drop = {
  id: number
  expr: string
  answer: number
  x: number
  y: number
  speed: number
  pop?: boolean
}

type Problem = { expr: string; answer: number }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '⌫'] as const
const LINE_Y = 93
const MAX_LIVES = 3

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function levelOf(score: number) {
  if (score >= 400) return 4
  if (score >= 200) return 3
  if (score >= 80) return 2
  return 1
}

function makeLevel1(): Problem {
  const kind = pick(['+', '-', 'x', ':'] as const)
  if (kind === '+') {
    const a = rand(1, 9)
    const b = rand(1, 9)
    return { expr: `${a} + ${b}`, answer: a + b }
  }
  if (kind === '-') {
    const a = rand(1, 9)
    const b = rand(1, 9)
    return { expr: `${a} - ${b}`, answer: a - b }
  }
  if (kind === 'x') {
    const a = rand(1, 9)
    const b = rand(1, 9)
    return { expr: `${a} x ${b}`, answer: a * b }
  }
  const [a, b] = pick([
    [8, 2],
    [6, 2],
    [9, 3],
    [8, 4],
    [6, 3],
    [4, 2],
  ])
  return { expr: `${a} : ${b}`, answer: a / b }
}

function makeLevel2(): Problem {
  if (Math.random() < 0.55) {
    const kind = pick(['+', '-', 'x', ':'] as const)
    if (kind === '+') {
      const a = rand(10, 99)
      const b = rand(10, 99)
      return { expr: `${a} + ${b}`, answer: a + b }
    }
    if (kind === '-') {
      const a = rand(10, 99)
      const b = rand(1, 99)
      return { expr: `${a} - ${b}`, answer: a - b }
    }
    if (kind === 'x') {
      const a = rand(10, 25)
      const b = rand(2, 12)
      return { expr: `${a} x ${b}`, answer: a * b }
    }
    const b = rand(2, 12)
    const q = rand(2, 12)
    const a = b * q
    if (a > 99) return makeLevel2()
    return { expr: `${a} : ${b}`, answer: q }
  }
  const form = rand(0, 3)
  if (form === 0) {
    const a = rand(1, 40)
    const b = rand(2, 12)
    const c = rand(2, 9)
    return { expr: `${a} + ${b} x ${c}`, answer: a + b * c }
  }
  if (form === 1) {
    const a = rand(2, 12)
    const b = rand(2, 9)
    const c = rand(1, 40)
    return { expr: `${a} x ${b} + ${c}`, answer: a * b + c }
  }
  if (form === 2) {
    const a = rand(20, 99)
    const b = rand(1, 20)
    const c = rand(1, 20)
    return { expr: `${a} - ${b} + ${c}`, answer: a - b + c }
  }
  const b = rand(2, 9)
  const q = rand(2, 12)
  const a = b * q
  const c = rand(1, 20)
  return { expr: `${a} : ${b} + ${c}`, answer: q + c }
}

function makeLevel3(): Problem {
  const form = rand(0, 3)
  if (form === 0) {
    const c = rand(2, 15)
    const q = rand(4, 40)
    const sum = c * q
    const a = rand(10, Math.max(10, sum - 10))
    const b = sum - a
    if (b < 1 || a > 999 || b > 999) return makeLevel3()
    return { expr: `(${a} + ${b}) : ${c}`, answer: q }
  }
  if (form === 1) {
    const a = rand(80, 350)
    const b = rand(2, 8)
    const c = rand(20, 200)
    return { expr: `${a} x ${b} - ${c}`, answer: a * b - c }
  }
  if (form === 2) {
    const a = rand(80, 400)
    const b = rand(10, Math.min(200, a - 1))
    const c = rand(2, 12)
    return { expr: `(${a} - ${b}) x ${c}`, answer: (a - b) * c }
  }
  const a = rand(100, 400)
  const b = rand(2, 9)
  const c = rand(10, 200)
  return { expr: `${a} + ${b} x ${c}`, answer: a + b * c }
}

function makeLevel4(): Problem {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const form = rand(0, 2)
    if (form === 0) {
      const a = rand(1500, 9000)
      const b = rand(200, Math.min(4000, a - 1))
      const answer = a - b
      if (answer >= 0 && answer <= 9999) return { expr: `${a} - ${b}`, answer }
    } else if (form === 1) {
      const b = rand(1, 8)
      const c = rand(1, 8)
      const den = b + c
      if (den < 2) continue
      const q = rand(2, Math.min(999, Math.floor(9999 / den)))
      const a = den * q
      if (a > 9999 || q > 9999) continue
      return { expr: `${a} : (${b} + ${c})`, answer: q }
    } else {
      const a = rand(200, 2000)
      const b = rand(2, 4)
      const c = rand(50, 800)
      const answer = a * b + c
      if (answer <= 9999) return { expr: `${a} x ${b} + ${c}`, answer }
    }
  }
  return { expr: '4500 - 1250', answer: 3250 }
}

function makeProblem(level: number): Problem {
  if (level >= 4) return makeLevel4()
  if (level === 3) return makeLevel3()
  if (level === 2) return makeLevel2()
  return makeLevel1()
}

function dropSpeed(score: number) {
  const base = 5 + Math.min(16, score * 0.025)
  return levelOf(score) >= 4 ? base * 0.8 : base
}

function spawnMs(score: number) {
  return Math.max(1100, 2800 - score * 2.5)
}

function maxDrops(score: number) {
  const level = levelOf(score)
  if (score === 0) return 1
  if (level === 1) return 2
  if (level === 2) return 3
  return 4
}

export function RainMathGame() {
  const [drops, setDrops] = useState<Drop[]>([])
  const [typed, setTyped] = useState('')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [hurt, setHurt] = useState(false)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState(() => readBestRainMath())
  const dropsRef = useRef<Drop[]>([])
  const typedRef = useRef('')
  const scoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)
  const overRef = useRef(false)
  const hitsRef = useRef(0)
  const levelsRef = useRef(0)
  const nextId = useRef(1)
  const lastSpawn = useRef(0)
  const lastTick = useRef(0)

  dropsRef.current = drops
  typedRef.current = typed
  scoreRef.current = score
  livesRef.current = lives
  overRef.current = over
  const level = levelOf(score)

  useEffect(() => {
    return () => {
      const hits = hitsRef.current
      const levels = levelsRef.current
      hitsRef.current = 0
      levelsRef.current = 0
      const gold = hits * GOLD.rainmathHit + levels * GOLD.rainmathLevel
      if (getGamified() && gold > 0) {
        awardGold(gold, `¡RainMath! +${gold} de oro 🪙`)
      }
    }
  }, [])

  function restart() {
    dropsRef.current = []
    typedRef.current = ''
    scoreRef.current = 0
    livesRef.current = MAX_LIVES
    overRef.current = false
    nextId.current = 1
    lastSpawn.current = 0
    setDrops([])
    setTyped('')
    setScore(0)
    setLives(MAX_LIVES)
    setHurt(false)
    setOver(false)
  }

  function spawn(now: number) {
    const current = dropsRef.current.filter((drop) => !drop.pop)
    if (current.length >= maxDrops(scoreRef.current)) return
    const problem = makeProblem(levelOf(scoreRef.current))
    const drop: Drop = {
      id: nextId.current,
      expr: problem.expr,
      answer: problem.answer,
      x: rand(3, 38),
      y: -8,
      speed: dropSpeed(scoreRef.current),
    }
    nextId.current += 1
    lastSpawn.current = now
    const next = [...current, drop]
    dropsRef.current = next
    setDrops(next)
  }

  function applyTyped(next: string) {
    typedRef.current = next
    setTyped(next)
    if (next === '' || next === '-') return
    const hit = dropsRef.current
      .filter((drop) => !drop.pop && String(drop.answer) === next)
      .sort((a, b) => b.y - a.y)[0]
    if (!hit) return
    const popped = dropsRef.current.map((drop) => (drop.id === hit.id ? { ...drop, pop: true } : drop))
    dropsRef.current = popped
    setDrops(popped)
    typedRef.current = ''
    setTyped('')
    const prevLevel = levelOf(scoreRef.current)
    const gained = 10 * prevLevel
    scoreRef.current += gained
    hitsRef.current += 1
    const nextLevel = levelOf(scoreRef.current)
    if (nextLevel > prevLevel) levelsRef.current += 1
    const saved = saveBestRainMath(scoreRef.current)
    setBest(saved)
    setScore(scoreRef.current)
    window.setTimeout(() => {
      const cleared = dropsRef.current.filter((drop) => drop.id !== hit.id)
      dropsRef.current = cleared
      setDrops(cleared)
    }, 280)
  }

  function loseLife(id: number) {
    if (overRef.current || livesRef.current <= 0) return
    const nextDrops = dropsRef.current.filter((drop) => drop.id !== id)
    dropsRef.current = nextDrops
    setDrops(nextDrops)
    lastSpawn.current = performance.now()
    livesRef.current -= 1
    setLives(livesRef.current)
    setHurt(true)
    window.setTimeout(() => setHurt(false), 260)
    if (livesRef.current <= 0) {
      overRef.current = true
      setOver(true)
    }
  }

  useEffect(() => {
    let frame = 0
    let active = true
    function tick(now: number) {
      if (!active) return
      if (!overRef.current) {
        if (!lastTick.current) lastTick.current = now
        const dt = Math.min(0.05, (now - lastTick.current) / 1000)
        lastTick.current = now
        if (!lastSpawn.current || now - lastSpawn.current >= spawnMs(scoreRef.current)) spawn(now)
        const moved = dropsRef.current.map((drop) =>
          drop.pop ? drop : { ...drop, y: drop.y + drop.speed * dt },
        )
        const missed = moved.find((drop) => !drop.pop && drop.y >= LINE_Y)
        if (missed) {
          dropsRef.current = moved
          loseLife(missed.id)
        } else if (moved.some((drop, index) => drop.y !== dropsRef.current[index]?.y)) {
          dropsRef.current = moved
          setDrops(moved)
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      active = false
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (overRef.current) return
      if (event.key >= '0' && event.key <= '9') {
        applyTyped(typedRef.current + event.key)
        return
      }
      if (event.key === '-' && typedRef.current === '') {
        applyTyped('-')
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        applyTyped(typedRef.current.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function blockZoom(event: Event) {
      event.preventDefault()
    }
    document.addEventListener('gesturestart', blockZoom)
    return () => document.removeEventListener('gesturestart', blockZoom)
  }, [])

  function press(key: (typeof KEYS)[number]) {
    if (over) return
    if (key === '⌫') {
      applyTyped(typed.slice(0, -1))
      return
    }
    if (key === '-') {
      if (typed === '') applyTyped('-')
      return
    }
    applyTyped(typed + key)
  }

  return (
    <div className={`rainmath${hurt ? ' is-hurt' : ''}`}>
      <div className="rainmath-hud">
        <div className="rainmath-hud-score">
          <span>Pts: {score}</span>
          <span>🥇: {best}</span>
        </div>
        <span>Nivel: {level}</span>
        <span className="rainmath-lives" aria-label={`${lives} vidas`}>
          {Array.from({ length: MAX_LIVES }, (_, index) => (index < lives ? '❤️' : '💔')).join('')}
        </span>
      </div>
      <div className="rainmath-field">
        {drops.map((drop) => (
          <span
            key={drop.id}
            className={`rainmath-drop${drop.pop ? ' is-pop' : ''}`}
            style={
              {
                left: 'clamp(8px, var(--drop-x), calc(100% - 8px))',
                top: `${drop.y}%`,
                maxWidth: 'calc(100% - 8px - clamp(8px, var(--drop-x), calc(100% - 8px)))',
                '--drop-x': `${drop.x}%`,
              } as CSSProperties
            }
          >
            {drop.expr}
          </span>
        ))}
        <div className="rainmath-line">
          <i />
          <span className="rainmath-umb">☂️</span>
          <p className="rainmath-typed" aria-live="polite">
            {typed || '\u00a0'}
          </p>
        </div>
      </div>
      <div className="rainmath-keys">
        {KEYS.map((key) => (
          <button key={key} type="button" className="rainmath-key" onClick={() => press(key)}>
            {key}
          </button>
        ))}
      </div>
      {over ? (
        <div className="rainmath-over">
          <p>Game Over</p>
          <strong>Pts: {score}</strong>
          <button type="button" className="primary-btn" onClick={restart}>
            Reiniciar
          </button>
        </div>
      ) : null}
    </div>
  )
}
