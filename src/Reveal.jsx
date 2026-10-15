import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'

const VERDICT = ['Drifted', 'One word kept', 'Close', 'Nailed it']

function pointsFor(step) {
  return step.close_enough ? 3 : step.score || 0
}

function rating(pct) {
  if (pct >= 0.85) return 'Practically telepathic'
  if (pct >= 0.65) return 'On the same wavelength'
  if (pct >= 0.4) return 'Mostly in sync'
  if (pct >= 0.2) return 'Creative differences'
  return 'Beautiful chaos'
}

export default function Reveal({ state, seat, act, PlayAgain }) {
  const chains = state.chains || []
  // playback: one card at a time per chain, then the summary
  const [chainIdx, setChainIdx] = useState(0)
  const [shown, setShown] = useState(1) // cards visible in current chain (prompt card counts as one)
  const [done, setDone] = useState(false)
  const endRef = useRef(null)

  const chain = chains[chainIdx]
  const cardCount = chain ? chain.steps.length + 1 : 0

  useEffect(() => {
    if (!done && endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [shown, chainIdx, done])

  const totals = useMemo(() => {
    let pts = 0, max = 0
    for (const c of chains) for (const s of c.steps) if (s.kind === 'guess') { pts += pointsFor(s); max += 3 }
    return { pts, max }
  }, [chains])

  function next() {
    if (shown < cardCount) setShown(shown + 1)
    else if (chainIdx < chains.length - 1) { setChainIdx(chainIdx + 1); setShown(1) }
    else setDone(true)
  }

  if (!chains.length) return null

  if (!done) {
    const atEnd = shown >= cardCount
    const label = !atEnd ? 'Next' : chainIdx < chains.length - 1 ? `Now ${chains[chainIdx + 1].owner_name}’s chain` : 'See your score'
    return (
      <section className="reveal">
        <div className="reveal-head">
          <h2>{chain.owner === state.seat ? 'Your chain' : `${chain.owner_name}’s chain`}</h2>
          <button className="btn btn-ghost small" onClick={() => setDone(true)}>Skip to score</button>
        </div>
        <ol className="chain">
          <PromptCard chain={chain} />
          {chain.steps.slice(0, shown - 1).map((s) => <StepCard key={s.id} step={s} fresh />)}
        </ol>
        <div ref={endRef} className="reveal-next">
          <button className="btn btn-primary btn-wide" onClick={next}>{label}</button>
        </div>
      </section>
    )
  }

  const pct = totals.max ? totals.pts / totals.max : 0
  const history = state.games || []
  const best = history.reduce((b, g) => Math.max(b, g.score), 0)

  return (
    <section className="reveal">
      <div className="scorecard panel">
        <p className="muted">Team score, game {state.game_no}</p>
        <p className="score-big"><span>{totals.pts}</span><span className="score-of">/ {totals.max}</span></p>
        <p className="score-rating">{rating(pct)}</p>
        {history.length > 1 && (
          <p className="muted small">Best tonight: {best}. Games played: {history.length}.</p>
        )}
        <p className="muted small">Scoring went too hard on a guess? Tap “Close enough” to give it full points.</p>
        <div className="score-actions">
          <PlayAgain state={state} seat={seat} act={act} />
        </div>
      </div>

      <div className="chains-grid">
        {chains.map((c) => (
          <div key={c.owner} className="chain-col">
            <div className="chain-col-head">
              <h3>{c.owner === state.seat ? 'Your chain' : `${c.owner_name}’s chain`}</h3>
              <button className="btn btn-ghost small" onClick={() => saveChainImage(c)}>Save image</button>
            </div>
            <ol className="chain">
              <PromptCard chain={c} />
              {c.steps.map((s) => (
                <StepCard key={s.id} step={s} onToggle={() => act(() => api.toggleClose(state.code, seat.token, s.id)).catch(() => {})} />
              ))}
            </ol>
            <p className="drift-line">
              Started as <span className="hand">{c.prompt}</span>, ended as{' '}
              <span className="hand">{(c.steps[c.steps.length - 1] || {}).content}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PromptCard({ chain }) {
  return (
    <li className="card card-prompt">
      <span className="card-meta">{chain.owner_name}’s phrase</span>
      <p className="hand hand-xl">{chain.prompt}</p>
    </li>
  )
}

function StepCard({ step, fresh, onToggle }) {
  if (step.kind === 'draw') {
    return (
      <li className={'card card-draw' + (fresh ? ' is-fresh' : '')}>
        <span className="card-meta">Drawn by {step.author_name}</span>
        <img src={step.content} alt={`Drawing by ${step.author_name}`} loading="lazy" />
      </li>
    )
  }
  const pts = pointsFor(step)
  return (
    <li className={'card card-guess' + (fresh ? ' is-fresh' : '')}>
      <span className="card-meta">{step.author_name} guessed</span>
      <p className="hand hand-l">{step.content}</p>
      <div className="verdict-row">
        <span className={`verdict v${pts}`}>{step.close_enough ? 'Close enough' : VERDICT[pts]} <b>+{pts}</b></span>
        {onToggle && (step.score < 3 || step.close_enough) && (
          <button className={'chip' + (step.close_enough ? ' is-on' : '')} aria-pressed={step.close_enough} onClick={onToggle}>
            {step.close_enough ? 'Undo' : 'Close enough'}
          </button>
        )}
      </div>
    </li>
  )
}

/* ---- export a chain as one tall image ---- */

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

async function saveChainImage(chain) {
  try { await document.fonts.load('40px "Gochi Hand"'); await document.fonts.load('600 20px "Bricolage Grotesque"') } catch {}
  const W = 720, pad = 40, imgW = W - pad * 2, imgH = imgW * 0.75
  const ink = '#1E1B6B', pink = '#FF4F8B', paper = '#F2F4FF'
  const blocks = [{ type: 'text', meta: `${chain.owner_name}’s phrase`, text: chain.prompt }]
  for (const s of chain.steps) {
    blocks.push(s.kind === 'draw'
      ? { type: 'img', meta: `Drawn by ${s.author_name}`, src: s.content }
      : { type: 'text', meta: `${s.author_name} guessed`, text: s.content })
  }
  const imgs = await Promise.all(blocks.map((b) => (b.type === 'img' ? loadImg(b.src).catch(() => null) : null)))
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = '44px "Gochi Hand"'
  const heights = blocks.map((b) => (b.type === 'img' ? imgH + 56 : 56 + wrap(measure, b.text, imgW).length * 50))
  const H = 120 + heights.reduce((a, b) => a + b + 24, 0) + 60

  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = ink; ctx.font = '800 40px "Bricolage Grotesque", sans-serif'
  ctx.fillText('Doodle Drift', pad, 72)
  let y = 120
  blocks.forEach((b, i) => {
    const h = heights[i]
    ctx.fillStyle = pink; ctx.fillRect(pad + 6, y + 6, imgW, h)
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(pad, y, imgW, h)
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(pad, y, imgW, h)
    ctx.fillStyle = ink; ctx.font = '600 18px "Bricolage Grotesque", sans-serif'
    ctx.fillText(b.meta, pad + 18, y + 32)
    if (b.type === 'img') {
      if (imgs[i]) ctx.drawImage(imgs[i], pad + 18, y + 44, imgW - 36, (imgW - 36) * 0.75)
    } else {
      ctx.font = '44px "Gochi Hand", cursive'
      wrap(ctx, b.text, imgW - 36).forEach((ln, k) => ctx.fillText(ln, pad + 18, y + 88 + k * 50))
    }
    y += h + 24
  })
  ctx.fillStyle = ink; ctx.font = '400 16px "Bricolage Grotesque", sans-serif'
  ctx.fillText(window.location.host, pad, H - 28)

  const a = document.createElement('a')
  a.download = `doodle-drift-${chain.prompt.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  a.href = c.toDataURL('image/png')
  a.click()
}
