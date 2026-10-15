// Publishable key: safe to ship to the browser. All game access goes through
// server-side functions that check each player's private seat token.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://zdrcbrxtotymkrxmvcmu.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_yWTOo_cf1x8IJOCSHevQvg_cTCSwgXC'

async function rpc(fn, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Something went wrong. Try again.')
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  createRoom: (name) => rpc('create_room', { p_name: name }),
  joinRoom: (code, name) => rpc('join_room', { p_code: code, p_name: name }),
  startGame: (code, token, settings) => rpc('start_game', { p_code: code, p_token: token, p_settings: settings }),
  setPrompt: (code, token, prompt) => rpc('set_prompt', { p_code: code, p_token: token, p_prompt: prompt }),
  submitStep: (code, token, content) => rpc('submit_step', { p_code: code, p_token: token, p_content: content }),
  toggleClose: (code, token, step) => rpc('toggle_close', { p_code: code, p_token: token, p_step: step }),
  getState: (code, token) => rpc('get_state', { p_code: code, p_token: token }),
  getVersion: (code, token) => rpc('get_version', { p_code: code, p_token: token }),
}

const KEY_PREFIX = 'dd:seat:'
export const seats = {
  get(code) {
    try { return JSON.parse(localStorage.getItem(KEY_PREFIX + code.toUpperCase())) } catch { return null }
  },
  set(code, seat) {
    try { localStorage.setItem(KEY_PREFIX + code.toUpperCase(), JSON.stringify(seat)) } catch {}
  },
  remove(code) {
    try { localStorage.removeItem(KEY_PREFIX + code.toUpperCase()) } catch {}
  },
  name() { try { return localStorage.getItem('dd:name') || '' } catch { return '' } },
  setName(n) { try { localStorage.setItem('dd:name', n) } catch {} },
}
