# AGENTS.md

typingSeal — MonkeyType-style typing test with bigram analytics, personalised practice, and optional LLM-generated passages. See `README.md` for the full feature/deployment/backup reference; this file covers what an agent needs in order to work safely.

## Repo shape

Two independent npm projects, **no root manifest or workspace**. `npm install` and every command run from inside the project directory.

| Path | Stack | Entry |
| --- | --- | --- |
| `backend/` | Node 22, Express 5, TypeScript, ESM, SQLite (`better-sqlite3`), Supabase auth | `index.ts` → `dist/index.js` |
| `frontend/` | React 19, Vite 8, TypeScript, react-router-dom 7, Tailwind v3, recharts | `src/main.tsx` → `src/App.tsx` |
| `scripts/` | Repo maintenance scripts (word-bank drift check) | — |

- **Node 22.x required** (`engines` in both `package.json`). The README says Node 20 — that is stale; trust `engines`. `better-sqlite3` is a native addon, so reinstall/rebuild if the Node major changes.
- `.env` files and `*.db` are gitignored on purpose; never commit secrets or local database files. `backend/.env.example` documents the backend variables.

## Commands

```bash
# backend  -> http://localhost:8000
cd backend && npm install && npm run dev      # tsx watch index.ts
cd backend && npm test                        # node --test via tsx (test/*.test.ts)
cd backend && npm run build                   # tsc -> dist/ (what npm start runs)
cd backend && npm run typecheck               # tsc --noEmit

# frontend -> http://localhost:5173
cd frontend && npm install && npm run dev
cd frontend && npm test                       # vitest run (src/**/*.test.ts[x])
cd frontend && npm run typecheck              # tsc --noEmit
```

- **Tests**: backend uses `node:test` in `backend/test/` (run through `tsx`, no dependencies); frontend uses Vitest + Testing Library, co-located as `frontend/src/**/*.test.{ts,tsx}` (config `frontend/vitest.config.ts`, cleanup in `src/test-setup.ts`). `backend/test/routes.test.ts` boots the real Express app on an ephemeral port with a stubbed auth. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build for both.
- **TypeScript**: both projects are strict. `backend/tsconfig.json` is the no-emit typecheck config; `backend/tsconfig.build.json` emits `dist/` (root files only, tests excluded). The frontend `npm run build` is `tsc --noEmit && vite build`, so a type error fails the build.
- Other automated verification: frontend `npm run lint` (oxlint, config `frontend/.oxlintrc.json`) and `npm run build` (tsc + Vite); `node scripts/check-word-bank.mjs` at the repo root (also covered by the backend suite).
- Tests that touch the DB set `DB_PATH=':memory:'` before dynamically importing `database.ts` (it opens the DB at import). Never import it statically in a test — a type-only `import type` is safe because it is erased. `createSession` needs a `users` row, so call `ensureUser(userId)` first.
- `frontend` also has `npm run preview`; `backend` has `npm run backup` / `npm run restore`.

## Architecture notes

- **Auth**: Supabase issues the JWT; `backend/auth.ts` verifies it per request with `supabase.auth.getUser(token)` and sets `req.userId` (declared in `backend/express.d.ts`). Every `/api/*` route requires a Bearer token **except** `GET /api/quotes` (public) and `POST /api/admin/backup` (uses an `x-backup-secret` header, fails closed). Frontend requests go through `src/api.ts` `apiFetch()`, which attaches the token and signs out on 401.
- **Guests**: unauthenticated users can take tests and use Quotes mode, but sessions are never persisted; `/dashboard` is the only route requiring sign-in.
- **Env loading**: each entrypoint loads `.env` with `import 'dotenv/config'` as its **first** import (`index.ts`, `backup.ts`, `restore.ts`). ESM evaluates imports in order, so this must precede `./database.ts` / `./auth.ts`, which read `process.env` at import time. `dbpath.ts` is side-effect free and only exposes `resolveDbPath()`; `backup.ts` reads env lazily through functions so merely importing it needs no config.
- **DB schema + migrations** live inline in `initDb()` (`backend/database.ts`) — no migration framework. Add columns with `addColumnIfMissing()`, remove with `dropColumnIfPresent()` (drop the index first). Quotes are seeded additively on every boot from `backend/sealFacts.ts` by matching text, not by an empty-table check.
- **Bigram stats are cached 5 min per user** (`getBigramStats`). Any write that adds sessions must call `invalidateBigramCache(userId)` or reads serve stale data.
- **Levels/prestige**: the XP curve lives only in `backend/leveling.ts` (pure). Level is derived from `users.xp` on read and never stored; `createSession()` awards XP in the same transaction as the session and `sessions.mode` records practice (2×). Prestige is a manual `POST /api/prestige`, only valid at level 100.
- **Testability seams**: `practice.ts`, `llmValidation.ts` and `leveling.ts` are pure (no DB/network) — `generatePractice({ stats })` receives stats from the caller, and `getLlmPractice` accepts an optional `fetchImpl`. `database.ts` still opens SQLite at import, so a test must set `DB_PATH=':memory:'` before importing it. `.env` is loaded by entrypoints via `import 'dotenv/config'` (their first import); `dbpath.ts` only exposes `resolveDbPath()` and never reads `.env`, so importing modules in tests cannot pick up the real database path. `entitlements.ts` accepts an optional `now` for deterministic quota tests.
- **Route tests**: `app.ts` exports `createApp({ requireAuth, logRequests })`, so routes can be exercised without `listen()`, a fixed port, or the backup schedule (all of which stay in `index.ts`). Gotcha: importing `app.ts` transitively imports `backup.ts`, whose first import is `dotenv/config`, so `.env` is loaded as a side effect — clear any env var a test depends on being *unset* **after** importing the app, not before.
- Config: `ALLOWED_ORIGINS` must include the frontend origin or CORS blocks everything (defaults to `localhost:5173,localhost:3000`). Frontend falls back to `http://localhost:8000` when `VITE_API_URL` is unset.

## Frontend conventions (non-obvious)

- **Theme**: use the `.theme-*` component classes from `src/index.css` (`.theme-panel`, `.theme-text`, `.theme-accent`, …) rather than raw palette colors. `slate`/`amber` are overridden in `tailwind.config.ts` and all border radii are zeroed except `rounded-full` (kept circular for spinners/avatars). Chart and keyboard-heatmap colors deliberately use Tailwind defaults so performance meaning (green→red) is preserved — do not theme them.
- **Monocraft font**: ligatures are disabled because they merge characters and break per-character coloring/caret placement in the test. Use the `font-pixel` class and whole multiples of 9px (18/36/72px) for crisp rendering.
- **`src/components/TypingTest.tsx`** is the core (~1300 lines) and contains intentional choices that look like mistakes: a hidden `readOnly` input captures keystrokes; the progress/stats bars use `invisible` (not conditional rendering) to avoid reflow; restart reuses an already-paid-for AI passage instead of regenerating; quota is peeked then consumed on success server-side. Preserve these.
- **The word bank is intentionally duplicated** in `frontend/src/components/TypingTest.tsx` and `backend/practice.ts`. Do not try to share one file across the two services: Railway builds each from its own directory, so a repo-root module is not in either build context. Edit both copies and run `node scripts/check-word-bank.mjs` from the repo root — it fails on drift.
- Vite inlines `VITE_*` env at dev-server start/build — restart the dev server after editing `frontend/.env`.

## Data, backups, LLM

- SQLite path resolves in `backend/dbpath.ts` (`DB_PATH`, default `backend/typing_test.db`). On Railway the filesystem is ephemeral; a persistent volume + `DB_PATH` is required or every deploy starts empty. Backups (`backend/backup.ts`) stay disabled until `SUPABASE_SERVICE_ROLE_KEY` is set.
- `backend/restore.ts` must run **inside the deployed container**, not locally, and the DB must not be open (it uses an atomic rename; `dbpath.ts` exists so locating the path does not open a connection). Never back up by copying the `.db` file — use SQLite's Online Backup API.
- **LLM practice** (`backend/llmPractice.ts`): `LLM_MODEL` has no default and must be set; do not pick a reasoning model. Invalid or truncated output is never cached. Bump `PROMPT_VERSION` to invalidate all cached passages. Cost/token columns exist so real spend is measured, not estimated.
