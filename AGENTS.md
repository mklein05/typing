# AGENTS.md

typingSeal — MonkeyType-style typing test with bigram analytics, personalised practice, and optional LLM-generated passages. See `README.md` for the full feature/deployment/backup reference; this file covers what an agent needs in order to work safely.

## Repo shape

Two independent npm projects, **no root manifest or workspace**. `npm install` and every command run from inside the project directory.

| Path | Stack | Entry |
| --- | --- | --- |
| `backend/` | Node 22, Express 5, ESM, SQLite (`better-sqlite3`), Supabase auth | `index.js` |
| `frontend/` | React 19, Vite 8, react-router-dom 7, Tailwind v3, recharts | `src/main.jsx` → `src/App.jsx` |
| `shared/` | `wordBank.mjs` — the one word list, imported by both sides | — |

- **Node 22.x required** (`engines` in both `package.json`). The README says Node 20 — that is stale; trust `engines`. `better-sqlite3` is a native addon, so reinstall/rebuild if the Node major changes.
- `.env` files and `*.db` are gitignored on purpose; never commit secrets or local database files. `backend/.env.example` documents the backend variables.

## Commands

```bash
# backend  -> http://localhost:8000
cd backend && npm install && npm run dev      # node --watch index.js

# frontend -> http://localhost:5173
cd frontend && npm install && npm run dev
```

- **There is no test suite, no typecheck, and no CI** (no `.github/`, no test runner anywhere). Do not look for one or claim tests pass.
- The only automated verification is frontend `npm run lint` (oxlint, config `frontend/.oxlintrc.json`) and `npm run build` (Vite). The backend has none — verify by running `npm run dev` and calling the API.
- `frontend` also has `npm run preview`; `backend` has `npm run backup` / `npm run restore`.

## Architecture notes

- **Auth**: Supabase issues the JWT; `backend/auth.js` verifies it per request with `supabase.auth.getUser(token)` and sets `req.userId`. Every `/api/*` route requires a Bearer token **except** `GET /api/quotes` (public) and `POST /api/admin/backup` (uses an `x-backup-secret` header, fails closed). Frontend requests go through `src/api.js` `apiFetch()`, which attaches the token and signs out on 401.
- **Guests**: unauthenticated users can take tests and use Quotes mode, but sessions are never persisted; `/dashboard` is the only route requiring sign-in.
- **Env loading gotcha**: ESM evaluates imports before a module body, so `dotenv.config()` in `index.js` runs *after* env-reading imports evaluate. `backend/dbpath.js` therefore imports `dotenv/config` itself, and `backup.js` reads env through functions rather than at module scope. Follow this pattern for any new config module.
- **DB schema + migrations** live inline in `initDb()` (`backend/database.js`) — no migration framework. Add columns with `addColumnIfMissing()`, remove with `dropColumnIfPresent()` (drop the index first). Quotes are seeded additively on every boot from `backend/sealFacts.js` by matching text, not by an empty-table check.
- **Bigram stats are cached 5 min per user** (`getBigramStats`). Any write that adds sessions must call `invalidateBigramCache(userId)` or reads serve stale data.
- Config: `ALLOWED_ORIGINS` must include the frontend origin or CORS blocks everything (defaults to `localhost:5173,localhost:3000`). Frontend falls back to `http://localhost:8000` when `VITE_API_URL` is unset.

## Frontend conventions (non-obvious)

- **Theme**: use the `.theme-*` component classes from `src/index.css` (`.theme-panel`, `.theme-text`, `.theme-accent`, …) rather than raw palette colors. `slate`/`amber` are overridden in `tailwind.config.js` and all border radii are zeroed except `rounded-full` (kept circular for spinners/avatars). Chart and keyboard-heatmap colors deliberately use Tailwind defaults so performance meaning (green→red) is preserved — do not theme them.
- **Monocraft font**: ligatures are disabled because they merge characters and break per-character coloring/caret placement in the test. Use the `font-pixel` class and whole multiples of 9px (18/36/72px) for crisp rendering.
- **`src/components/TypingTest.jsx`** is the core (~1300 lines) and contains intentional choices that look like mistakes: a hidden `readOnly` input captures keystrokes; the progress/stats bars use `invisible` (not conditional rendering) to avoid reflow; restart reuses an already-paid-for AI passage instead of regenerating; quota is peeked then consumed on success server-side. Preserve these.
- **One shared word bank**: `shared/wordBank.mjs` (repo root) is imported by both `TypingTest.jsx` and `backend/practice.js`. Edit it once and both the standard test and practice pick it up. Because it sits outside both service directories, Vite's dev server reads it via `server.fs.allow` in `frontend/vite.config.js`, and each Railway build must have the repo root in context. It must stay `.mjs` so Node treats it as ESM without a nearest `package.json`.
- Vite inlines `VITE_*` env at dev-server start/build — restart the dev server after editing `frontend/.env`.

## Data, backups, LLM

- SQLite path resolves in `backend/dbpath.js` (`DB_PATH`, default `backend/typing_test.db`). On Railway the filesystem is ephemeral; a persistent volume + `DB_PATH` is required or every deploy starts empty. Backups (`backend/backup.js`) stay disabled until `SUPABASE_SERVICE_ROLE_KEY` is set.
- `backend/restore.js` must run **inside the deployed container**, not locally, and the DB must not be open (it uses an atomic rename; `dbpath.js` exists so locating the path does not open a connection). Never back up by copying the `.db` file — use SQLite's Online Backup API.
- **LLM practice** (`backend/llmPractice.js`): `LLM_MODEL` has no default and must be set; do not pick a reasoning model. Invalid or truncated output is never cached. Bump `PROMPT_VERSION` to invalidate all cached passages. Cost/token columns exist so real spend is measured, not estimated.
