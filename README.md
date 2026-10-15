# Doodle Drift

A two-player drawing game. Each player picks a secret phrase, then you take turns drawing and guessing each other's chains until the reveal shows how far each phrase drifted. You score together.

## Stack

- **Frontend:** Vite + React, deployed on Vercel
- **Backend:** Supabase Postgres. All game rules live in SQL functions (`create_room`, `join_room`, `start_game`, `set_prompt`, `submit_step`, `toggle_close`, `get_state`, `get_version`). Tables are locked with RLS; each player gets a private seat token stored in their browser.
- **Sync:** clients poll a lightweight `get_version` every ~1.2s and fetch full state only when it changes, so it works live or turn-by-turn.

## Develop

```bash
npm install
npm run dev
```

Optional env vars (defaults point at the production Supabase project):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` (publishable key)

## Scoring

Each guess is compared to what was drawn: 3 for an exact match, 2 if at least half the key words survive, 1 for one shared word, 0 otherwise. Players can mark any guess "close enough" during the reveal for full points.
