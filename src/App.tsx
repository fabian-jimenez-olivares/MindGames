import { useState, type CSSProperties, type ReactNode } from 'react'
import { SemaforoLoco } from './MindGames'
import { RainMathGame } from './RainMathGame'
import { bumpToolUse } from './stubs/hooks/useToolUse'

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

export default function App() {
  const [game, setGame] = useState<GameId | null>(null)

  function choose(next: GameId | null) {
    setGame(next)
    if (next) bumpToolUse('mindgames')
  }

  if (!game) {
    return (
      <main className="game-shell">
        <h1>MindGames</h1>
        <p className="hub-lead">Entrena mente y reflejos.</p>
        <section className="panel aldea-hub-panel">
          <nav className="module-grid memoria-grid" aria-label="MindGames">
            {GAMES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="module-tile aldea-module-tile"
                style={{ '--tile-accent': item.accent } as CSSProperties}
                onClick={() => choose(item.id)}
              >
                <span className="module-icon">
                  <Glyph>{item.icon}</Glyph>
                </span>
                <span className="module-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </section>
      </main>
    )
  }

  const title = GAMES.find((item) => item.id === game)?.label ?? ''

  return (
    <main className={`game-shell memoria-play${game === 'rainmath' ? ' is-rainmath' : ''}`}>
      <header className="hub-play-bar">
        <button type="button" className="action-btn" onClick={() => choose(null)}>
          ← MindGames
        </button>
        <h1>{title}</h1>
      </header>
      {game === 'semaforo' ? <SemaforoLoco /> : null}
      {game === 'rainmath' ? <RainMathGame /> : null}
    </main>
  )
}
