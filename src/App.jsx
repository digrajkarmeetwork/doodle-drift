import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, seats } from './api.js'
import { PACKS, deal } from './prompts.js'
import Sketchpad from './Sketchpad.jsx'
import Reveal from './Reveal.jsx'

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const on = () => setPath(window.location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  const go = useCallback((p) => { window.history.pushState({}, '', p); setPath(p) }, [])
  return [path, go]
}

export default function App() {
  const [path, go] = useRoute()
  const m = path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/)
  return (
    <div className="shell">
      <header className="masthead">
        <a href="/" className="wordmark" onClick={(e) => { e.preventDefault(); go('/') }}>
          <span className="wordmark-d">Doodle</span> <span className="wordmark-drift">Drift</span>
        </a>
      </header>
      {m ? <Room code={m[1].toUpperCase()} go={go} /> : <Home go={go} />}
    </div>
  )
}

/* ---------------- Home ---------------- */

function Home({ go }) {
  const [name, setName] = useState(seats.name())
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Enter your name to start.')
    setBusy(true); setErr('')
    try {
      seats.setName(name.trim())
      const s = await api.createRoom(name.trim())
      seats.set(s.code, s)
      go(`/r/${s.code}`)
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  function join(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(c)) return setErr('Game codes are 5 letters or numbers.')
    if (name.trim()) seats.setName(name.trim())
    go(`/r/${c}`)
  }

  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero-title">Draw it.<br />Guess it.<br />Watch it drift.</h1>
        <p className="hero-sub">A drawing game for two. You each start a phrase, then take turns drawing and guessing until it comes back around, usually as something completely different.</p>
      </section>

      <section className="panel start-panel">
        <form onSubmit={create} className="stack">
          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="e.g. Meet" autoComplete="nickname" />
          </label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Starting…' : 'Start a game'}</button>
        </form>
        <div className="or"><span>or join your partner</span></div>
        <form onSubmit={join} className="join-row">
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={5}
            placeholder="CODE"
            aria-label="Game code"
            autoCapitalize="characters"
          />
          <button className="btn">Join</button>
        </form>
        {err && <p className="error" role="alert">{err}</p>}
      </section>

      <section className="how">
        <h2>How a game goes</h2>
        <ol>
          <li><strong>Pick a phrase.</strong> You each choose one secretly. Try the “Us two” pack for date-night prompts.</li>
          <li><strong>Draw, then guess.</strong> You both draw at the same time, then guess each other’s drawing. Your guess becomes their next thing to draw.</li>
          <li><strong>Watch the drift.</strong> Replay both chains side by side. You score together for every guess that stays on track.</li>
        </ol>
        <p className="how-note">Play in the same room or miles apart. Your game is saved, so you can also take turns whenever you have a minute.</p>
      </section>
    </main>
  )
}

/* ---------------- Room ---------------- */

function Room({ code, go }) {
  const [seat, setSeat] = useState(() => seats.get(code))
  const [state, setState] = useState(null)
  const [err, setErr] = useState('')
  const [missing, setMissing] = useState(false)
  const version = useRef('')
  const offset = useRef(0)

  const load = useCallback(async () => {
    if (!seat) return
    try {
      const s = await api.getState(code, seat.token)
      offset.current = new Date(s.server_now).getTime() - Date.now()
      setState(s)
      setErr('')
    } catch (e) {
      if (/No game/.test(e.message)) setMissing(true)
      else if (/Not in this game/.test(e.message)) { seats.remove(code); setSeat(null) }
      else setErr(e.message)
    }
  }, [code, seat])

  useEffect(() => {
    if (!seat) return
    let stop = false
    let t
    const tick = async () => {
      try {
        const v = await api.getVersion(code, seat.token)
        if (v !== version.current) { version.current = v; await load() }
      } catch (e) {
        if (/No game/.test(e.message)) setMissing(true)
        else if (/Not in this game/.test(e.message)) { seats.remove(code); setSeat(null) }
      }
      if (!stop) t = setTimeout(tick, document.hidden ? 5000 : 1200)
    }
    tick()
    const onVis = () => { if (!document.hidden) { clearTimeout(t); tick() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [code, seat, load])

  const act = useCallback(async (fn) => {
    setErr('')
    try { await fn(); version.current = ''; await load() } catch (e) { setErr(e.message); throw e }
  }, [load])

  if (missing) {
    return (
      <main className="panel center-panel">
        <h2>No game with code {code}</h2>
        <p>Check the code with your partner, or start a new game.</p>
        <button className="btn btn-primary" onClick={() => go('/')}>Back to start</button>
      </main>
    )
  }
  if (!seat) return <JoinForm code={code} onJoined={(s) => { seats.set(code, s); setSeat(s) }} go={go} />
  if (!state) return <main className="panel center-panel"><p className="muted">Opening game {code}…</p></main>

  return (
    <main className="room">
      <StatusBar state={state} />
      {err && <p className="error banner" role="alert">{err}</p>}
      {state.phase === 'lobby' && <Lobby state={state} seat={seat} act={act} />}
      {state.phase === 'prompt' && <PromptPhase key={state.game_no} state={state} seat={seat} act={act} />}
      {state.phase === 'draw' && <DrawPhase key={`d${state.game_no}-${state.round}`} state={state} seat={seat} act={act} offset={offset} />}
      {state.phase === 'guess' && <GuessPhase key={`g${state.game_no}-${state.round}`} state={state} seat={seat} act={act} offset={offset} />}
      {state.phase === 'reveal' && <Reveal key={`r${state.game_no}`} state={state} seat={seat} act={act} PlayAgain={PlayAgain} />}
    </main>
  )
}

function JoinForm({ code, onJoined, go }) {
  const [name, setName] = useState(seats.name())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Enter your name to join.')
    setBusy(true); setErr('')
    try {
      seats.setName(name.trim())
      onJoined(await api.joinRoom(code, name.trim()))
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <main className="panel center-panel">
      <p className="muted">You’re invited to game</p>
      <p className="big-code">{code}</p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus autoComplete="nickname" />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Joining…' : 'Join game'}</button>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
      {err && /two players/.test(err) && <button className="btn btn-ghost" onClick={() => go('/')}>Start your own game</button>}
    </main>
  )
}

const PHASE_LABEL = { lobby: 'Getting ready', prompt: 'Choosing phrases', draw: 'Drawing', guess: 'Guessing', reveal: 'The reveal' }

function StatusBar({ state }) {
  const total = state.settings.rounds
  const partnerDone = state.task && state.task.partner_done
  const showPartner = ['prompt', 'draw', 'guess'].includes(state.phase)
  return (
    <div className="statusbar">
      <div className="status-left">
        <span className="status-phase">{PHASE_LABEL[state.phase]}</span>
        {(state.phase === 'draw' || state.phase === 'guess') && <span className="status-round">Round {state.round} of {total}</span>}
      </div>
      <div className="status-right">
        {state.partner_name ? (
          <span className={'partner' + (showPartner ? (partnerDone ? ' is-done' : ' is-busy') : '')}>
            <span className="dot" aria-hidden="true" />
            {state.partner_name}
            {showPartner && <span className="sr-only">{partnerDone ? ' is done' : ' is still going'}</span>}
          </span>
        ) : <span className="partner is-busy"><span className="dot" aria-hidden="true" />Waiting for partner</span>}
        <span className="status-code" title="Game code">{state.code}</span>
      </div>
    </div>
  )
}

/* ---------------- Lobby ---------------- */

const TIMERS = [{ v: 0, l: 'No timer' }, { v: 45, l: '45s' }, { v: 60, l: '60s' }, { v: 90, l: '90s' }]

function Lobby({ state, seat, act }) {
  const isHost = state.seat === 'h'
  const [settings, setSettings] = useState(state.settings)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/r/${state.code}`

  async function share() {
    const text = `Play Doodle Drift with me! Code ${state.code}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Doodle Drift', text, url: link }); return } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <div className="lobby">
      {isHost && (
        <section className="panel invite">
          {state.partner_name ? (
            <>
              <h2>{state.partner_name} is here</h2>
              <p className="muted">Pick your settings and start when you’re both ready.</p>
            </>
          ) : (
            <>
              <h2>Invite your partner</h2>
              <p className="muted">Send them this link, or have them enter the code on the home page.</p>
              <p className="big-code" aria-label={`Game code ${state.code.split('').join(' ')}`}>{state.code}</p>
              <button className="btn" onClick={share}>{copied ? 'Link copied' : 'Share invite link'}</button>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <h2>{isHost ? 'Game settings' : `${state.partner_name} is setting up the game`}</h2>
        <div className="setting">
          <span className="setting-label">Phrase pack</span>
          <div className="packs">
            {Object.entries(PACKS).map(([k, p]) => (
              <button
                key={k}
                type="button"
                className={'pack' + (settings.pack === k ? ' is-on' : '')}
                aria-pressed={settings.pack === k}
                disabled={!isHost}
                onClick={() => setSettings({ ...settings, pack: k })}
              >
                <span className="pack-name">{p.label}</span>
                <span className="pack-blurb">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting">
            <span className="setting-label">Rounds</span>
            <div className="seg">
              {[2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={settings.rounds === n ? 'is-on' : ''} aria-pressed={settings.rounds === n} disabled={!isHost} onClick={() => setSettings({ ...settings, rounds: n })}>{n}</button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span className="setting-label">Drawing time</span>
            <div className="seg">
              {TIMERS.map((t) => (
                <button key={t.v} type="button" className={settings.timer === t.v ? 'is-on' : ''} aria-pressed={settings.timer === t.v} disabled={!isHost} onClick={() => setSettings({ ...settings, timer: t.v })}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="muted small">Each round you both draw once and guess once, so {settings.rounds} rounds makes {settings.rounds * 2} hops per chain.</p>
        {isHost ? (
          <button
            className="btn btn-primary btn-wide"
            disabled={!state.partner_name}
            onClick={() => act(() => api.startGame(state.code, seat.token, settings)).catch(() => {})}
          >
            {state.partner_name ? 'Start game' : 'Waiting for your partner to join…'}
          </button>
        ) : <p className="waiting-line">Waiting for {state.partner_name} to start</p>}
      </section>
    </div>
  )
}

function PlayAgain({ state, seat, act }) {
  if (state.seat !== 'h') return <p className="waiting-line">Waiting for {state.partner_name} to start another game</p>
  return (
    <button className="btn btn-primary" onClick={() => act(() => api.startGame(state.code, seat.token, state.settings)).catch(() => {})}>
      Play again
    </button>
  )
}

/* ---------------- Prompt ---------------- */

function PromptPhase({ state, seat, act }) {
  const pack = state.settings.pack
  const [options, setOptions] = useState(() => deal(pack, 3))
  const [own, setOwn] = useState('')
  const [busy, setBusy] = useState(false)
  const t = state.task

  async function choose(p) {
    if (!p.trim()) return
    setBusy(true)
    try { await act(() => api.setPrompt(state.code, seat.token, p.trim())) } catch {} finally { setBusy(false) }
  }

  if (t.me_done) {
    return (
      <section className="panel center-panel">
        <p className="muted">Your phrase</p>
        <p className="hand hand-xl">{t.my_prompt}</p>
        <p className="waiting-line">Waiting for {state.partner_name} to pick theirs</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2>Pick a secret phrase</h2>
      <p className="muted">You’ll draw it first. {state.partner_name} will never see it until the reveal.</p>
      <div className="options">
        {options.map((o) => (
          <button key={o} className="option hand" disabled={busy} onClick={() => choose(o)}>{o}</button>
        ))}
      </div>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setOptions(deal(pack, 3, options))}>Show me different ones</button>
      <form className="own" onSubmit={(e) => { e.preventDefault(); choose(own) }}>
        <label className="field">
          <span>Or write your own</span>
          <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={60} placeholder={pack === 'couples' ? 'something only you two would get' : 'anything you can draw'} />
        </label>
        <button className="btn" disabled={busy || !own.trim()}>Use this</button>
      </form>
    </section>
  )
}

/* ---------------- Timer ---------------- */

function useCountdown(deadline, offset) {
  const [left, setLeft] = useState(null)
  useEffect(() => {
    if (!deadline) { setLeft(null); return }
    const end = new Date(deadline).getTime()
    const tick = () => setLeft(Math.max(0, Math.ceil((end - (Date.now() + offset.current)) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline, offset])
  return left
}

function Countdown({ left }) {
  if (left == null) return null
  return <span className={'countdown' + (left <= 10 ? ' is-low' : '')} aria-live={left <= 10 ? 'polite' : 'off'}>{left}s</span>
}

/* ---------------- Draw ---------------- */

function DrawPhase({ state, seat, act, offset }) {
  const pad = useRef(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const t = state.task
  const left = useCountdown(state.deadline, offset)
  const fired = useRef(false)

  const submit = useCallback(async (force) => {
    if (!pad.current || busy) return
    if (!force && pad.current.isEmpty()) { setHint('Draw something first. Stick figures count.'); return }
    setBusy(true); setHint('')
    try { await act(() => api.submitStep(state.code, seat.token, pad.current.exportImage())) } catch {} finally { setBusy(false) }
  }, [act, busy, seat.token, state.code])

  useEffect(() => {
    if (left === 0 && !t.me_done && !fired.current) { fired.current = true; submit(true) }
  }, [left, t.me_done, submit])

  if (t.me_done) {
    return (
      <section className="panel center-panel">
        <p className="muted">Drawing sent</p>
        <p className="waiting-line">Waiting for {state.partner_name} to finish drawing</p>
      </section>
    )
  }

  return (
    <section className="panel draw-panel">
      <div className="task-head">
        <div>
          <p className="muted">{state.round === 1 ? 'Draw your phrase' : `${state.partner_name} guessed this. Draw it`}</p>
          <p className="hand hand-xl target">{t.target}</p>
        </div>
        <Countdown left={left} />
      </div>
      <Sketchpad ref={pad} disabled={busy} />
      <p className="muted small">No letters or numbers. That’s the only rule.</p>
      {hint && <p className="error" role="alert">{hint}</p>}
      <button className="btn btn-primary btn-wide" disabled={busy} onClick={() => submit(false)}>{busy ? 'Sending…' : 'Send drawing'}</button>
    </section>
  )
}

/* ---------------- Guess ---------------- */

function GuessPhase({ state, seat, act, offset }) {
  const [guess, setGuess] = useState('')
  const [busy, setBusy] = useState(false)
  const t = state.task
  const left = useCountdown(state.deadline, offset)
  const fired = useRef(false)
  const guessRef = useRef('')
  guessRef.current = guess

  const submit = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try { await act(() => api.submitStep(state.code, seat.token, guessRef.current)) } catch {} finally { setBusy(false) }
  }, [act, busy, seat.token, state.code])

  useEffect(() => {
    if (left === 0 && !t.me_done && !fired.current) { fired.current = true; submit() }
  }, [left, t.me_done, submit])

  if (t.me_done) {
    return (
      <section className="panel center-panel">
        <p className="muted">Guess sent</p>
        <p className="waiting-line">Waiting for {state.partner_name} to finish guessing</p>
      </section>
    )
  }

  return (
    <section className="panel guess-panel">
      <div className="task-head">
        <p className="muted">What did {state.partner_name} draw?</p>
        <Countdown left={left} />
      </div>
      <figure className="drawing-frame">
        <img src={t.drawing} alt={`${state.partner_name}'s drawing`} />
      </figure>
      <form onSubmit={(e) => { e.preventDefault(); if (guess.trim()) submit() }} className="guess-row">
        <input
          className="guess-input hand"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          maxLength={60}
          placeholder="I think it’s…"
          aria-label="Your guess"
          autoFocus
        />
        <button className="btn btn-primary" disabled={busy || !guess.trim()}>{busy ? 'Sending…' : 'Send guess'}</button>
      </form>
      <p className="muted small">Your guess becomes {state.partner_name}’s next thing to draw.</p>
    </section>
  )
}
