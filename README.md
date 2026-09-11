# typingSeal

A MonkeyType-style typing test with personalised practice, bigram analytics and a seal theme.

## Project structure

| Path | What it is |
| --- | --- |
| `frontend/` | React 19 + Vite app — typing test, dashboard, charts |
| `backend/` | Node 20 + Express API — SQLite (`better-sqlite3`), Supabase auth |

## Local development

Run each in its own terminal.

**Backend** — <http://localhost:8000>

```bash
cd backend
npm install
npm run dev      # node --watch index.js
```

**Frontend** — <http://localhost:5173>

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the API via `VITE_API_URL`, falling back to `http://localhost:8000` when unset.

## Environment variables

Both files are gitignored — never commit real secrets.

`frontend/.env`

| Variable | Notes |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe for the browser) |
| `VITE_API_URL` | Production only; unset locally so the localhost fallback applies |

`backend/.env`

| Variable | Notes |
| --- | --- |
| `PORT` | Defaults to `8000` |
| `SUPABASE_URL` | Used server-side to verify access tokens |
| `SUPABASE_ANON_KEY` | |
| `ALLOWED_ORIGINS` | Comma-separated. Must include the deployed frontend URL |
| `DB_PATH` | Optional. Where the SQLite file lives — see below |

## Data and persistence

The SQLite database defaults to `backend/typing_test.db`. It is **gitignored on purpose**:
local data should never be committed or shipped in a deploy.

Railway containers have an **ephemeral filesystem**, so anything written at runtime is
discarded on every redeploy. To actually keep data:

1. Attach a volume mounted at `/data` to the backend service.
2. Set `DB_PATH=/data/typing_test.db`.

Without that, every deploy starts from an empty database.

## Deployment (Railway)

Two services built from this one repository:

| Service | Root directory | Start command |
| --- | --- | --- |
| Backend | `backend` | `npm start` |
| Frontend | `frontend` | Vite build output (`dist/`) |

Backend environment variables must be set in the Railway dashboard, including
`ALLOWED_ORIGINS` with the deployed frontend URL — otherwise CORS will block every request.

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| frontend | `npm run dev` | Vite dev server with HMR |
| frontend | `npm run build` | Production build into `frontend/dist` |
| frontend | `npm run preview` | Serve the production build locally |
| frontend | `npm run lint` | Oxlint |
| backend | `npm run dev` | Express with `--watch` |
| backend | `npm start` | Express (used by Railway) |

## Implementation notes

- **Fonts** — Monocraft (OFL-1.1) lives in `frontend/public/fonts/`. Its programming
  ligatures are **disabled** in `frontend/src/index.css`: Monocraft merges multi-character
  sequences into single glyphs, which breaks per-character colouring and caret placement in
  the typing test. The font's design grid is 120/1080 em, so text is pixel-perfect at whole
  multiples of 9px (18px, 36px, 72px…).
- **Theming** — Tailwind v3. The `slate` and `amber` scales are overridden in
  `frontend/tailwind.config.js` for the dark-mint + gold palette, and border radii are
  zeroed for squared corners. Chart and keyboard-heatmap colours are deliberately left as
  Tailwind defaults so that performance meaning (green → red) is preserved.
- **Auth** — Supabase issues the token; the backend verifies it with
  `supabase.auth.getUser(token)` on every protected route. Stats are scoped per user.
- **Practice mode** — targets the user's weakest bigrams, filtered to bigrams the word bank
  can actually produce, then builds a distinct word list so a test can never collapse into
  one word repeated.
