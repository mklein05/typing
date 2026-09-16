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
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. Enables off-site backups — see below |
| `BACKUP_BUCKET` | Optional. Defaults to `db-backups` |
| `BACKUP_RETENTION_DAYS` | Optional. Defaults to `14` |
| `BACKUP_INTERVAL_HOURS` | Optional. Defaults to `24` |
| `BACKUP_SECRET` | Optional. Only needed to trigger backups over HTTP |
| `FREE_LLM_DAILY_LIMIT` | Optional. Free-tier daily allowance for metered features. Defaults to `3` |

## Data and persistence

The SQLite database defaults to `backend/typing_test.db`. It is **gitignored on purpose**:
local data should never be committed or shipped in a deploy.

Railway containers have an **ephemeral filesystem**, so anything written at runtime is
discarded on every redeploy. To actually keep data:

1. Attach a volume mounted at `/data` to the backend service.
2. Set `DB_PATH=/data/typing_test.db`.

Without that, every deploy starts from an empty database.

## Backups

The volume is durable across redeploys, but nothing copies it anywhere. If it is corrupted,
detached, or deleted, every session and keystroke goes with it. `backend/backup.js` takes
daily snapshots and ships them to **Supabase Storage**, so that loss is recoverable.

### Setup

1. Create a **private** Storage bucket in Supabase named `db-backups`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` on the backend service (Railway → Variables).

Backups stay off until that key is set: the server logs `[backup] disabled` on boot.
Once set, `[backup] every 24h → db-backups (retain 14d)` confirms it is running.

The service role key bypasses row-level security, so it is **server-side only** and must
never be exposed to the browser.

### How snapshots are taken

`db.backup()` uses SQLite's **Online Backup API**, which is safe while the app is actively
writing. Do not back up by copying the `.db` file: a write in flight can produce a torn file
that opens without complaint and is quietly missing rows.

Every snapshot is opened and checked with `PRAGMA integrity_check` before upload, and its row
counts are logged — a snapshot that silently contains nothing is worse than no snapshot,
because it looks like safety. Snapshots past the retention window are pruned, except the
newest one, which is never deleted.

Objects are filed under a folder per environment — `production/` in a deploy, `local/` on a
laptop — so a snapshot from one can never be mistaken for, or restored over, the other. The
folder name comes from `RAILWAY_ENVIRONMENT_NAME`, which Railway sets automatically; override
it with `BACKUP_LABEL`.

### Triggering a backup

| Method | How |
| --- | --- |
| Schedule | Automatic, every `BACKUP_INTERVAL_HOURS`. Also fires on boot if the newest snapshot is already stale, so frequent redeploys cannot skip backups indefinitely |
| CLI | `npm run backup` inside `backend/` |
| HTTP | `curl -X POST -H "x-backup-secret: $BACKUP_SECRET" <backend-url>/api/admin/backup` |

The HTTP route lets an external scheduler (Railway cron, GitHub Actions) drive backups. It
uses a shared secret rather than a Supabase token so a scheduler never holds user
credentials, and it **fails closed**: with `BACKUP_SECRET` unset, every request gets a 401.

### Restoring

Run this **inside the deployed container, not locally** — locally it would overwrite your dev
database instead of the volume. Use the Railway dashboard's service Shell, or
`railway ssh --service backend`.

```bash
node restore.js --list          # snapshots, newest first
node restore.js                 # restore the newest
node restore.js typing_test-2026-09-14T02-00-00-000Z.db
```

The snapshot is downloaded and integrity-checked *before* the live file is touched, the
current file is kept as `<db>.pre-restore-<timestamp>`, and the swap itself is an atomic
`rename`. Restart the backend service afterwards so it reopens the new file — the running
process holds its previous handle until then, so nothing is swapped out from under a live
request.

**Test a restore before you need one.** An untested restore path is not a backup.

## Premium entitlements

`backend/entitlements.js` owns plans and metered usage. It is deliberately
provider-agnostic: whatever sells the subscription (Paddle, Lemon Squeezy, Stripe) only
has to call `setPremium()` from a webhook. Nothing there knows which one it is.

| Piece | Where |
| --- | --- |
| `users.plan`, `users.premium_until` | Added by a guarded migration in `initDb()` |
| `usage_counters` | One row per user, per feature, per UTC day |
| `getEntitlements(userId)` | Plan + remaining allowance, served at `GET /api/entitlements` |
| `consumeQuota(userId, feature)` | Checks the allowance and consumes one unit |
| `requireQuota(feature)` | Express middleware, ready to attach to a metered route |
| `setPremium(userId, { premium, until })` | The **only** writer of the plan columns |

Checks are server-side and always local. The client can be edited, and a webhook can fail
to arrive, so `premium_until` is enforced in the read path — a missed cancellation webhook
cannot leave someone premium forever.

**Nothing is gated yet.** `requireQuota` exists but is attached to no route, so no existing
behaviour changes. The LLM generation route attaches it when it lands.

The daily counter uses UTC, so allowances roll over at midnight UTC rather than the user's
local midnight. Premium usage is counted too — it is the only way to see what the feature
actually costs.

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
| backend | `npm run backup` | Take and upload a snapshot now |
| backend | `npm run restore` | Restore a snapshot over the live database |

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
