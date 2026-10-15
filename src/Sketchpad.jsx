import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const W = 800
const H = 600
export const INKS = [
  { name: 'Ink', value: '#1E1B6B' },
  { name: 'Pink', value: '#FF4F8B' },
  { name: 'Sun', value: '#FFB400' },
  { name: 'Mint', value: '#17A889' },
  { name: 'Sky', value: '#3D8BFF' },
  { name: 'Brown', value: '#8A5A3C' },
]
const SIZES = [4, 10, 24]

const Sketchpad = forwardRef(function Sketchpad({ disabled }, ref) {
  const canvasRef = useRef(null)
  const strokes = useRef([])
  const current = useRef(null)
  const [color, setColor] = useState(INKS[0].value)
  const [size, setSize] = useState(SIZES[1])
  const [eraser, setEraser] = useState(false)
  const [count, setCount] = useState(0)

  const ctx = () => canvasRef.current.getContext('2d')

  function paintStroke(c, s) {
    c.strokeStyle = s.color
    c.fillStyle = s.color
    c.lineWidth = s.size
    c.lineCap = 'round'
    c.lineJoin = 'round'
    const p = s.points
    if (p.length === 1) {
      c.beginPath(); c.arc(p[0][0], p[0][1], s.size / 2, 0, Math.PI * 2); c.fill(); return
    }
    c.beginPath()
    c.moveTo(p[0][0], p[0][1])
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2
      const my = (p[i][1] + p[i + 1][1]) / 2
      c.quadraticCurveTo(p[i][0], p[i][1], mx, my)
    }
    const last = p[p.length - 1]
    c.lineTo(last[0], last[1])
    c.stroke()
  }

  function redraw() {
    const c = ctx()
    c.fillStyle = '#FFFFFF'
    c.fillRect(0, 0, W, H)
    for (const s of strokes.current) paintStroke(c, s)
    if (current.current) paintStroke(c, current.current)
  }

  useEffect(() => { redraw() }, [])

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    exportImage() {
      const out = document.createElement('canvas')
      out.width = 600; out.height = 450
      const oc = out.getContext('2d')
      oc.drawImage(canvasRef.current, 0, 0, 600, 450)
      let url = out.toDataURL('image/webp', 0.82)
      if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.85)
      return url
    },
    clear() { strokes.current = []; current.current = null; setCount(0); redraw() },
  }))

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
  }

  function down(e) {
    if (disabled) return
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    current.current = { color: eraser ? '#FFFFFF' : color, size: eraser ? Math.max(size, 24) : size, points: [pos(e)] }
    redraw()
  }
  function move(e) {
    if (!current.current) return
    const events = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e]
    for (const ev of events.length ? events : [e]) current.current.points.push(pos(ev))
    redraw()
  }
  function up() {
    if (!current.current) return
    strokes.current.push(current.current)
    current.current = null
    setCount(strokes.current.length)
    redraw()
  }
  function undo() {
    strokes.current.pop()
    setCount(strokes.current.length)
    redraw()
  }
  function clearAll() {
    strokes.current = []
    setCount(0)
    redraw()
  }

  return (
    <div className={'sketchpad' + (disabled ? ' is-disabled' : '')}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="sketch-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Drawing area"
      />
      <div className="tools" role="toolbar" aria-label="Drawing tools">
        <div className="tool-group">
          {INKS.map((ink) => (
            <button
              key={ink.value}
              type="button"
              className={'swatch' + (!eraser && color === ink.value ? ' is-on' : '')}
              style={{ '--swatch': ink.value }}
              onClick={() => { setColor(ink.value); setEraser(false) }}
              aria-label={ink.name}
              aria-pressed={!eraser && color === ink.value}
              disabled={disabled}
            />
          ))}
        </div>
        <div className="tool-group">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={'size' + (size === s ? ' is-on' : '')}
              onClick={() => setSize(s)}
              aria-label={`Brush size ${s}`}
              aria-pressed={size === s}
              disabled={disabled}
            >
              <span style={{ width: Math.min(s, 18), height: Math.min(s, 18) }} />
            </button>
          ))}
          <button type="button" className={'tool-text' + (eraser ? ' is-on' : '')} onClick={() => setEraser(!eraser)} aria-pressed={eraser} disabled={disabled}>Eraser</button>
          <button type="button" className="tool-text" onClick={undo} disabled={disabled || count === 0}>Undo</button>
          <button type="button" className="tool-text" onClick={clearAll} disabled={disabled || count === 0}>Clear</button>
        </div>
      </div>
    </div>
  )
})

export default Sketchpad
