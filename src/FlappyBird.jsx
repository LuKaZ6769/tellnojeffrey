import { useCallback, useEffect, useRef, useState } from 'react'
import './flappy.css'

const hasSupabaseConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL
    && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
)
const WIDTH = 480
const HEIGHT = 640
const FLOOR = 590
const BIRD_X = 112
const PIPE_WIDTH = 72
const PIPE_GAP = 166
const LEADERBOARD_KEY = 'flappy-bird-leaderboard'

function readLocalScores() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LEADERBOARD_KEY) || '[]')
    return Array.isArray(saved)
      ? saved.filter((entry) => typeof entry.name === 'string' && Number.isInteger(entry.score))
        .sort((a, b) => b.score - a.score).slice(0, 10)
      : []
  } catch (error) {
    throw new Error(`Could not read the local leaderboard: ${error.message}`)
  }
}

function newGame() {
  return {
    birdY: HEIGHT * 0.45,
    velocity: 0,
    pipes: [{ x: WIDTH + 35, gapY: 282, scored: false }],
    elapsed: 0,
    score: 0,
  }
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

function drawScene(context, game, status, frame) {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, '#9de5ee')
  sky.addColorStop(1, '#e3f7d8')
  context.fillStyle = sky
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.fillStyle = '#fff3bb'
  context.beginPath()
  context.arc(384, 118, 47, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#a8d9c2'
  context.beginPath()
  context.moveTo(0, 420)
  context.quadraticCurveTo(95, 331, 192, 416)
  context.quadraticCurveTo(315, 323, 480, 414)
  context.lineTo(480, FLOOR)
  context.lineTo(0, FLOOR)
  context.fill()

  game.pipes.forEach((pipe) => {
    const gapTop = pipe.gapY - PIPE_GAP / 2
    const gapBottom = pipe.gapY + PIPE_GAP / 2
    context.fillStyle = '#4d9d65'
    roundedRect(context, pipe.x, -10, PIPE_WIDTH, gapTop + 10, 7)
    roundedRect(context, pipe.x - 6, gapTop - 18, PIPE_WIDTH + 12, 22, 6)
    roundedRect(context, pipe.x, gapBottom, PIPE_WIDTH, FLOOR - gapBottom, 7)
    roundedRect(context, pipe.x - 6, gapBottom - 4, PIPE_WIDTH + 12, 22, 6)
    context.fillStyle = '#74bd7b'
    context.fillRect(pipe.x + 10, 0, 8, Math.max(0, gapTop - 20))
    context.fillRect(pipe.x + 10, gapBottom + 24, 8, Math.max(0, FLOOR - gapBottom - 24))
  })

  context.fillStyle = '#6abf72'
  context.fillRect(0, FLOOR, WIDTH, 9)
  context.fillStyle = '#dfc58b'
  context.fillRect(0, FLOOR + 9, WIDTH, HEIGHT - FLOOR - 9)
  context.fillStyle = '#c9ad70'
  for (let x = -24; x < WIDTH + 24; x += 32) {
    context.fillRect(x - ((frame * 0.18) % 32), FLOOR + 22, 16, 5)
  }

  const birdY = status === 'ready' ? HEIGHT * 0.45 + Math.sin(frame / 330) * 8 : game.birdY
  context.save()
  context.translate(BIRD_X, birdY)
  context.rotate(Math.min(Math.PI / 3, Math.max(-Math.PI / 5, game.velocity / 700)))
  context.fillStyle = '#f4a844'
  context.beginPath()
  context.ellipse(0, 0, 18, 15, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fff9e8'
  context.beginPath()
  context.ellipse(6, -6, 7, 8, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#344153'
  context.beginPath()
  context.arc(9, -6, 2.2, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#ed7650'
  context.beginPath()
  context.moveTo(14, 1)
  context.lineTo(27, 4)
  context.lineTo(14, 8)
  context.closePath()
  context.fill()
  context.fillStyle = '#e28c37'
  context.beginPath()
  context.ellipse(-5, 5, 8, 5, -0.35, 0, Math.PI * 2)
  context.fill()
  context.restore()

  if (status === 'playing') {
    context.textAlign = 'center'
    context.font = '800 44px system-ui, sans-serif'
    context.lineWidth = 5
    context.strokeStyle = '#344f4b77'
    context.strokeText(String(game.score), WIDTH / 2, 76)
    context.fillStyle = '#fffdf4'
    context.fillText(String(game.score), WIDTH / 2, 76)
  }
}

function leaderboardEntry(entry, index) {
  return {
    id: entry.id || `${entry.name}-${entry.score}-${index}`,
    name: entry.player_name || entry.name,
    score: Number(entry.score),
  }
}

export default function FlappyBird() {
  const canvasRef = useRef(null)
  const gameRef = useRef(newGame())
  const statusRef = useRef('ready')
  const flapRef = useRef(() => {})
  const [status, setStatus] = useState('ready')
  const [score, setScore] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState(null)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    async function loadLeaderboard() {
      try {
        let client = null
        if (hasSupabaseConfig) {
          const { supabase: configuredClient } = await import('./supabase.js')
          if (!configuredClient) throw new Error('Supabase client could not be created.')
          client = configuredClient
          if (active) setSupabaseClient(client)
        }
        if (client) {
          const { data, error } = await client
            .from('flappy_scores')
            .select('id, player_name, score, created_at')
            .order('score', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(10)
          if (error) throw error
          if (active) setLeaderboard((data || []).map(leaderboardEntry))
        } else if (active) {
          setLeaderboard(readLocalScores().map(leaderboardEntry))
        }
      } catch (error) {
        if (active) setLeaderboardError(`Could not load the leaderboard: ${error.message}`)
      } finally {
        if (active) setLeaderboardLoading(false)
      }
    }
    loadLeaderboard()
    return () => { active = false }
  }, [])

  const startGame = useCallback(() => {
    gameRef.current = newGame()
    setScore(0)
    setSaved(false)
    setSaveError('')
    statusRef.current = 'playing'
    setStatus('playing')
    flapRef.current()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let animationFrame
    let previousTime = 0
    let frame = 0
    const game = gameRef.current
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const bounds = canvas.getBoundingClientRect()
      canvas.width = Math.round(bounds.width * ratio)
      canvas.height = Math.round(bounds.height * ratio)
      context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    flapRef.current = () => {
      if (statusRef.current === 'playing') gameRef.current.velocity = -430
    }

    const tick = (time) => {
      const currentGame = gameRef.current
      const currentStatus = statusRef.current
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.035) : 0
      previousTime = time
      frame += delta * 1000

      if (currentStatus === 'playing') {
        currentGame.elapsed += delta
        currentGame.velocity += 1450 * delta
        currentGame.birdY += currentGame.velocity * delta
        currentGame.pipes.forEach((pipe) => { pipe.x -= 170 * delta })
        if (currentGame.pipes[currentGame.pipes.length - 1].x < WIDTH - 245) {
          currentGame.pipes.push({
            x: WIDTH + 25,
            gapY: 190 + Math.random() * 250,
            scored: false,
          })
        }
        currentGame.pipes = currentGame.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -10)

        for (const pipe of currentGame.pipes) {
          const overlapsBird = BIRD_X + 13 > pipe.x && BIRD_X - 13 < pipe.x + PIPE_WIDTH
          if (overlapsBird && (currentGame.birdY - 12 < pipe.gapY - PIPE_GAP / 2
            || currentGame.birdY + 12 > pipe.gapY + PIPE_GAP / 2)) {
            statusRef.current = 'over'
            setStatus('over')
            break
          }
          if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.scored = true
            currentGame.score += 1
            setScore(currentGame.score)
          }
        }
        if (currentGame.birdY - 12 < 0 || currentGame.birdY + 12 > FLOOR) {
          statusRef.current = 'over'
          setStatus('over')
        }
      }

      drawScene(context, gameRef.current, statusRef.current, frame)
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    const handleKeyDown = (event) => {
      if ((event.code === 'Space' || event.code === 'ArrowUp') && statusRef.current === 'playing') {
        event.preventDefault()
        flapRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const flap = () => {
    if (statusRef.current === 'playing') flapRef.current()
  }

  const saveScore = async (event) => {
    event.preventDefault()
    const name = playerName.trim()
    if (!name || saving || saved) return
    setSaving(true)
    setSaveError('')
    try {
      let entry
      if (hasSupabaseConfig) {
        if (!supabaseClient) throw new Error('Supabase is still connecting. Please try again.')
        const { data, error } = await supabaseClient
          .from('flappy_scores')
          .insert({ player_name: name, score })
          .select('id, player_name, score, created_at')
          .single()
        if (error) throw error
        entry = leaderboardEntry(data)
      } else {
        const entries = readLocalScores()
        const id = globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
        entry = leaderboardEntry({ id, name, score }, entries.length)
        const updated = [...entries, { name, score }].sort((a, b) => b.score - a.score).slice(0, 10)
        window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated))
      }
      setLeaderboard((entries) => [...entries, entry].sort((a, b) => b.score - a.score).slice(0, 10))
      setSaved(true)
    } catch (error) {
      setSaveError(`Could not save your score: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flappy-page">
      <aside className="flappy-leaderboard" aria-label="Leaderboard">
        <div className="leaderboard-heading">
          <span className="leaderboard-icon" aria-hidden="true">♛</span>
          <div><p>THE FLOCK</p><h2>Leaderboard</h2></div>
          <span className={`leaderboard-live ${hasSupabaseConfig ? 'online' : ''}`} title={hasSupabaseConfig ? 'Online leaderboard' : 'Saved on this device'} />
        </div>
        <div className="leaderboard-list" aria-live="polite">
          {leaderboardLoading ? <p className="leaderboard-note">Loading scores...</p>
            : leaderboard.length ? leaderboard.map((entry, index) => (
              <div className={`leaderboard-row ${index === 0 ? 'leaderboard-first' : ''}`} key={entry.id}>
                <span className="leaderboard-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="leaderboard-name">{entry.name}</span>
                <strong>{entry.score}</strong>
              </div>
            )) : <p className="leaderboard-note">No scores yet. Be the first!</p>}
        </div>
        {leaderboardError && <p className="game-error" role="alert">{leaderboardError}</p>}
        <p className="leaderboard-caption">{hasSupabaseConfig ? 'All-time high scores' : 'Saved on this device'}</p>
      </aside>

      <section className="flappy-game" aria-label="Flappy Bird game">
        <header className="game-header">
          <div className="game-brand"><span className="game-brand-mark">✦</span><span>SKY<span>HOP</span></span></div>
          <span className="game-pill"><i /> ONE MORE FLIGHT</span>
        </header>
        <div className="game-title"><span>THE SKY IS YOURS</span><h1>Flappy <em>Bird</em></h1><p>Tap, flap, and see how far you can fly.</p></div>
        <div className="game-board">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={flap}
            aria-label={`Flappy Bird playfield. Current score: ${score}.`}
          />
          {status === 'ready' && <div className="game-overlay"><div className="overlay-card"><span className="overlay-emoji">🐤</span><p className="overlay-kicker">READY, BIRDIE?</p><h2>Your next high score<br />starts right here.</h2><p>Press space or tap the screen to flap.</p><button className="play-button" onClick={startGame}>Start flying <span>↗</span></button></div></div>}
          {status === 'over' && <div className="game-overlay"><div className="overlay-card game-over-card"><span className="overlay-emoji">✦</span><p className="overlay-kicker">FLIGHT COMPLETE</p><h2>Nice flying!</h2><div className="final-score"><span>YOUR SCORE</span><strong>{score}</strong></div>
            {saved ? <div className="saved-message" role="status">✓ Score saved to the leaderboard!</div> : <form className="score-form" onSubmit={saveScore}><label htmlFor="player-name">Put your name on the board</label><div className="score-input-row"><input id="player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={20} autoComplete="nickname" placeholder="Your name" required /><button className="save-button" type="submit" disabled={!playerName.trim() || saving || (hasSupabaseConfig && (!supabaseClient || leaderboardLoading))}>{saving ? 'Saving...' : 'Save score'}</button></div>{saveError && <p className="game-error" role="alert">{saveError}</p>}</form>}
            <button className="play-again-button" onClick={startGame}>Play again <span>↻</span></button></div></div>}
        </div>
        <footer className="game-instructions"><span><kbd>SPACE</kbd> or <kbd>↑</kbd> to flap</span><i /> <span>Tap the sky on mobile</span></footer>
      </section>
      <div className="game-decoration game-decoration-one" aria-hidden="true">✦</div>
      <div className="game-decoration game-decoration-two" aria-hidden="true">✧</div>
    </main>
  )
}
