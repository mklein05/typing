# typingSeal

A MonkeyType-style typing test with personalised practice, bigram analytics and a seal theme.

## Project structure

| Path | What it is |
| --- | --- |
| `frontend/` | React 19 + Vite + TypeScript app — typing test, dashboard, charts |
| `backend/` | Node 22 + Express + TypeScript API — SQLite (`better-sqlite3`), Supabase auth |
| `scripts/` | Repo maintenance scripts (word-bank drift check) |
| `deploy/` | Host config for the AWS deployment (`Caddyfile`) |

## Local development

Run each in its own terminal.

**Backend** — <http://localhost:8000>

```bash
cd backend
npm install
npm run dev      # tsx watch index.ts
```

The backend is TypeScript. `npm run dev` and `npm test` run the sources directly
through `tsx`; `npm run build` compiles to `backend/dist/`, which is what
`npm start` and the deployed containers run. `npm run typecheck` checks without
emitting.

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
| `OPENROUTER_API_KEY` | Optional. Enables LLM-generated practice |
| `LLM_MODEL` | Required for LLM practice. An OpenRouter slug, e.g. `vendor/model` |
| `LLM_TIMEOUT_MS` | Optional. Defaults to `8000` |

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
detached, or deleted, every session and keystroke goes with it. `backend/backup.ts` takes
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
node dist/restore.js --list          # snapshots, newest first
node dist/restore.js                 # restore the newest
node dist/restore.js typing_test-2026-09-14T02-00-00-000Z.db
```

The snapshot is downloaded and integrity-checked *before* the live file is touched, the
current file is kept as `<db>.pre-restore-<timestamp>`, and the swap itself is an atomic
`rename`. Restart the backend service afterwards so it reopens the new file — the running
process holds its previous handle until then, so nothing is swapped out from under a live
request.

**Test a restore before you need one.** An untested restore path is not a backup.

## Premium entitlements

`backend/entitlements.ts` owns plans and metered usage. It is deliberately
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

## Experience and levels

Every correct character in a saved test earns 1 XP, doubled in practice mode (drills and
AI passages included). XP is counted **server-side** from the stored keystrokes — the client
never sends an XP value.

- **Levels 1–100.** The XP needed to advance grows each level:
  `totalXpToReach(level) = 10 * (level - 1)^2`, so level 100 is ~98,000 XP.
- **Level is derived, never stored.** `backend/leveling.ts` is the only place the curve
  lives; the server computes the level from `users.xp` on read, so there is one source of
  truth and no drift.
- **Prestige is manual.** At level 100 the profile menu and dashboard offer a Prestige
  button. It resets XP to 0 and level to 1, increments `users.prestige`, and the prestige is
  shown in Roman numerals. XP earned while sitting at 100 is discarded.
- **Guests earn nothing** — their sessions are never saved, so there is no XP to award.

| Piece | Where |
| --- | --- |
| The XP curve | `backend/leveling.ts` (`CURVE_A`, `MAX_LEVEL`) |
| `users.xp`, `users.prestige`, `users.lifetime_xp` | Guarded migration in `initDb()` |
| `sessions.mode`, `sessions.xp_earned` | Records practice (2×) and what each session awarded |
| XP award | `createSession()` — same transaction as the session insert |
| Level + progress | `GET /api/profile` |
| Prestige | `POST /api/prestige` (rejected below level 100) |
| Display | Header profile menu, results screen, dashboard XP bar |

## LLM-generated practice

`backend/llmPractice.ts` generates a short passage of natural text engineered to be dense in
the user's weakest bigrams. It is returned as `practice_words` — exactly the shape the
practice pipeline already consumes, so **no frontend render changes are needed**.

### Setup

Set `OPENROUTER_API_KEY` and `LLM_MODEL` on the backend service. `LLM_MODEL` deliberately has
**no default**: slugs are priced per model and change often, so the code refuses to guess one.
Pick from openrouter.ai/models. While either is unset the route reports the feature as
unavailable rather than failing.

### Choosing a model

**Do not use a reasoning model.** They bill their "thinking" as completion tokens, and on a
short constrained-writing task that dwarfs the passage itself.

Measured seal-themed on the hard bigram set `gh/ck/ng/pl`, 5 samples each, 2 attempts allowed:

| Model | $/1k | Pass | Bigram hits | Fabricated words | Latency |
| --- | --- | --- | --- | --- | --- |
| `meta-llama/llama-3.1-8b-instruct` | $0.0108 | 5/5 | 12.8 | **0.6** | 3453ms |
| **`google/gemini-3.1-flash-lite`** | $0.12 | 5/5 | **17.0** | **0.0** | **1346ms** |
| `~anthropic/claude-haiku-latest` | $0.42 | 5/5 | 18.2 | 0.0 | 1801ms |
| `deepseek/deepseek-v4.1-flash` | — | failed | — | — | 5912ms |

The cheapest model is disqualified: `llama-3.1-8b` invents words under constraint — `ngers`
("fingers" with `fi` removed), `plodged`, `ghilliedressed`, `cling-ing`. A user typing those
learns nothing. Gemini is fastest, denser, and never fabricated in testing.

At ~$0.0001 a passage, 90,000 passages/month — 1,000 daily free users at 3/day with *zero*
cache reuse — is roughly **$9/month**. With profile sharing it is a fraction of that. Cost is
not the constraint here; quality is.

Truncated output is rejected rather than validated: a passage cut off mid-sentence can still
pass the length and bigram checks, and would then be cached for everyone sharing that profile.

Note that catalogue presence is not availability — `openai/gpt-5.2-chat` is listed but returns
404 "no endpoints found". Verify any slug with a live call before committing to it.

### Why it is affordable

The passage is a pure function of the target bigrams, so it is cached under a hash of:

```
prompt version | model | requested word count | sorted target bigrams
```

Repeat requests become a database read, and **users who share a weakness profile share a
passage**. Bumping `PROMPT_VERSION` invalidates everything; so does changing the model,
deliberately.

Token counts and cost are stored per generation. OpenRouter returns `usage.cost`
automatically — no request parameter is needed, and the old `usage: { include: true }`
parameter is deprecated and does nothing. The real cost of the feature is therefore measured
rather than estimated.

### Validation

Invalid output is **never cached**: one bad passage would otherwise be served to everyone
sharing that profile. Before caching, `validatePassage` requires:

| Check | Threshold | Catches |
| --- | --- | --- |
| Printable ASCII only | — | curly quotes and em dashes, which are untypeable |
| Word count | 70–140% of the request | truncated or padded output |
| Target bigram coverage | ≥ 60% present | text that ignores the targets |
| Bigram density | ≥ 0.25 per word | text that mentions them once |
| Unique words | ≥ 50% | repeat-to-fill |
| Every word has a vowel | — | bare bigrams padded in as words (`"every ng night"`) |
| Function-word ratio | ≥ 20% | word salad that scores well on density by ceasing to be language |

A rejection gets one stricter retry, then the request falls back to the deterministic
generator. `getLlmPractice` never throws.

### Quota

Charged **on success only**. The route peeks with `peekQuota()` and consumes with
`consumeQuota()` only after a validated passage comes back, so a provider outage does not cost
the user one of their daily allowances. This is why the route does not use `requireQuota()`,
which consumes before the handler runs.

## Deployment (Railway)

Two services built from this one repository:

| Service | Root directory | Start command |
| --- | --- | --- |
| Backend | `backend` | `npm start` |
| Frontend | `frontend` | `npm start` (`serve -s dist`) |

`serve -s` is required, not cosmetic: the app uses client-side routing, so
`/dashboard`, `/practice`, `/privacy` and `/terms` only resolve on a direct load
if unknown paths fall back to `index.html`.

The backend is TypeScript, so its `npm start` (`node dist/index.js`) only works
after a build. Railpack runs the `build` script (`tsc -p tsconfig.build.json`)
before `start`; the AWS image builds it in its own stage (see below).

### Frontend caching

`frontend/public/serve.json` sets the cache policy for the static server (it is
copied into `dist/` by Vite, where `serve` picks it up):

- `index.html` and every SPA route → `Cache-Control: no-cache`, so a deploy is
  picked up on the next load instead of serving a stale app shell.
- `assets/**` (Vite's content-hashed output) → `max-age=31536000, immutable`.

Without this, `index.html` was served with no cache headers at all, and a
Cloudflare zone in front of the site applied its 4-hour default browser cache
TTL to assets. A browser holding an old `index.html` would keep loading the old
hashed bundles, which looked like the site randomly reverting to an old build.

If Cloudflare proxies the frontend, set **Caching → Browser Cache TTL** to
*Respect Existing Headers* (otherwise it can override the origin's policy), and
purge the cache once after deploying this change.

The typing word list is duplicated on purpose in `frontend/src/components/TypingTest.tsx`
and `backend/practice.ts`, so each service builds from its own directory with no
cross-directory imports. Edit both copies together and run
`node scripts/check-word-bank.mjs` from the repo root — it exits non-zero if they
ever drift apart.

Backend environment variables must be set in the Railway dashboard, including
`ALLOWED_ORIGINS` with the deployed frontend URL — otherwise CORS will block every request.

## Deployment (AWS)

A second deployment that runs **in parallel** with Railway. Railway serves
`typingseal.com`; AWS serves `aws.typingseal.com`. The two share one Supabase
project, so the same account can sign in to either — but they have **separate
SQLite databases**, so sessions, bigram stats and XP are per-deployment.

### Shape

| Piece | Service | Hostname |
| --- | --- | --- |
| Frontend | S3 (private) + CloudFront with Origin Access Control | `aws.typingseal.com` |
| Backend | EC2 `t4g.micro` (arm64) + EBS data volume, Docker Compose | `api.aws.typingseal.com` |
| API TLS | Caddy on the instance (Let's Encrypt, HTTP-01) | — |
| Site TLS | ACM certificate, in **`us-east-1` only** | — |
| DNS | Cloudflare, both records **DNS only** | — |

There is no load balancer and no NAT gateway: Caddy terminates TLS on the
instance, and the instance sits in a public subnet with only 80/443 open. That is
what keeps the bill to the instance, its IP and the volume.

### Deploy files

| File | Purpose |
| --- | --- |
| `backend/Dockerfile.aws` | Multi-stage build. Compiles the TypeScript in a build stage, then ships `dist/` and production dependencies to the runtime stage. `better-sqlite3` is a native addon, so it is installed in the same Debian/Node 22 base the app runs on — a `node_modules` built on Windows produces a binary the container cannot load. |
| `backend/.dockerignore` | Load-bearing. Docker does not read `.gitignore`, so without it `COPY . .` would bake `.env` and `typing_test.db` into an image layer, and then into any registry the image reaches. |
| `backend/compose.yaml` | One service. Sets `DB_PATH=/data/typing_test.db` and `BACKUP_LABEL=aws`, mounts the EBS volume, and publishes the port to loopback only. |
| `deploy/Caddyfile` | Reverse proxy and automatic TLS for the API hostname. |

### Backend Docker image

`backend/Dockerfile.aws` builds the backend for EC2 (see `backend/compose.yaml`).
It is **not** named `Dockerfile` on purpose: Railway auto-detects a file with
that exact name in the service root and would build with it, then run as the
unprivileged `node` user (uid 1000), which cannot write Railway's root-owned
`/data` volume — reads work but every write endpoint returns 500. The different
name keeps Railway on Railpack.

This matters because a mounted volume **shadows** the image's `/data`, so the
`chown` in the Dockerfile has no effect at runtime. On EC2 the EBS volume must be
made writable by the container user once, on the host:

```bash
sudo chown -R 1000:1000 /data     # uid 1000 is `node` in the image
```

Without that, the AWS container has the same read-only-database failure.

### Backend environment

Same variables as Railway, with three that must differ:

| Variable | Value | Why |
| --- | --- | --- |
| `DB_PATH` | `/data/typing_test.db` | The EBS volume, not the container's ephemeral filesystem. Set by `compose.yaml`. |
| `BACKUP_LABEL` | `aws` | `backup.ts` falls back to `RAILWAY_ENVIRONMENT_NAME`, which does not exist on AWS — without this, snapshots land in `local/` and collide with a laptop's. |
| `ALLOWED_ORIGINS` | `https://aws.typingseal.com` | Otherwise CORS blocks every request. |

### One-time setup

1. **EC2** — Ubuntu 24.04 LTS **arm64** (it must match the Graviton instance),
   `t4g.micro`, a key pair, and a security group allowing 22, 80 and 443. For
   port 22, allow both your own IP **and** the region's EC2 Instance Connect
   prefix list (`com.amazonaws.<region>.ec2-instance-connect`): the browser-based
   console client connects from that range, not from your IP. **Never open 8000.**
2. **Elastic IP**, associated with the instance, so the DNS record survives a
   reboot.
3. **EBS volume** — `gp3`, same Availability Zone, attached at `/dev/sdf`,
   formatted `ext4`, mounted at `/data` by **UUID** with `nofail`, and owned by
   uid `1000` (see above). Delete-on-termination off.
4. **Docker** and a swapfile — `npm ci` for a native module can exhaust 1 GB of RAM.
5. `git clone`, `cp .env.example .env` and fill it in, then
   `docker compose up -d --build`.
6. **Caddy** on the host, with `deploy/Caddyfile` copied to `/etc/caddy/Caddyfile`.
7. **Cloudflare DNS** — `api.aws` A → the Elastic IP, and `aws` CNAME → the
   CloudFront distribution domain. Both **DNS only (grey cloud)**: with the orange
   cloud on, Cloudflare terminates TLS, so the Let's Encrypt HTTP-01 challenge
   cannot complete.
8. **ACM certificate** for `aws.typingseal.com`, requested **in `us-east-1`**
   (CloudFront accepts nothing else), DNS-validated with a `_hash.aws` CNAME in
   Cloudflare. Leave that record in place — ACM renews through it.
9. **CloudFront** — the S3 **REST** endpoint as origin with an Origin Access
   Control, the alternate domain name, default root object `index.html`, and
   custom error responses mapping **both 403 and 404** to `/index.html` with a
   200. This is the CloudFront equivalent of `serve -s`: an OAC bucket returns
   403, not 404, for a missing key, so `/dashboard` needs the 403 mapping.
10. **Bucket policy** granting `cloudfront.amazonaws.com` `s3:GetObject`, scoped
    with an `AWS:SourceArn` condition so no other distribution can read the
    bucket.
11. **Supabase → Authentication → URL Configuration** — add
    `https://aws.typingseal.com` to **Redirect URLs**. The client asks for
    `redirectTo: window.location.origin`; if that origin is not allowlisted,
    Supabase **silently falls back to the Site URL** and sends the user to
    `typingseal.com` instead. Nothing in the app reports the mismatch.

### Caching

The two CloudFront behaviors reproduce `frontend/public/serve.json`:

| Behavior | CloudFront cache policy | Object metadata |
| --- | --- | --- |
| `assets/*` | `CachingOptimized` | `public, max-age=31536000, immutable` |
| `*` (default) | `CachingDisabled` | `no-cache` |

The metadata is written at upload time (`aws s3 sync --cache-control`). The
default behavior deliberately does not cache `index.html` — the same
stale-app-shell problem the Railway caching section describes, enforced at a
different layer.

### Deploy loop

Frontend — rebuild, sync in two passes, then invalidate:

```bash
cd frontend
npm run build
aws s3 sync dist s3://typingseal-aws-site --delete --exclude "assets/*" --cache-control "no-cache"
aws s3 sync dist/assets s3://typingseal-aws-site/assets --cache-control "public, max-age=31536000, immutable"
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

`VITE_API_URL` is inlined at build time, so the frontend must be rebuilt whenever
the API origin changes. Create `frontend/.env.production` containing
`VITE_API_URL=https://api.aws.typingseal.com`; it is gitignored, so Railway's
build (which points at its own API) is unaffected.

Backend:

```bash
cd ~/typing && git pull
cd backend && docker compose up -d --build
```

### Why one instance only

SQLite is single-writer, and two other things assume a single process:

- `getBigramStats` caches per process, and `invalidateBigramCache` only clears
  the local copy — with two replicas, the other serves up to 5 minutes of stale
  stats.
- `startBackupSchedule()` runs a `setInterval` in every process, so N replicas
  would take N duplicate snapshots.

Scaling out therefore needs all three: a networked database, a shared cache, and
a single owner for the schedule. `POST /api/admin/backup` already exists so an
external scheduler can drive backups with a shared secret instead of an
in-process timer.

### Cost

Roughly **$13–20/month** in `us-east-1`: the `t4g.micro`, its public IPv4, an
8–20 GB gp3 volume, and a domain already paid for on Cloudflare. CloudFront's
always-free tier (1 TB + 10M requests/month) and the S3 and egress allowances
cover the app's traffic. There is no ALB (~$16+/month) and no NAT gateway
(~$32+/month) by design. New AWS accounts are on a credit model — $100 on
sign-up, up to $200, with a free plan that ends after 6 months or when the credit
runs out — so set a budget alarm before creating anything.

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| frontend | `npm run dev` | Vite dev server with HMR |
| frontend | `npm run build` | Production build into `frontend/dist` |
| frontend | `npm start` | Serve the build with SPA fallback (`serve -s dist`) |
| frontend | `npm run preview` | Serve the production build locally |
| frontend | `npm run lint` | Oxlint |
| frontend | `npm run typecheck` | Type-check without emitting |
| frontend | `npm test` | Run the frontend tests (Vitest + Testing Library) |
| backend | `npm run dev` | Express via `tsx watch` |
| backend | `npm run build` | Compile TypeScript to `backend/dist/` (`tsc`) |
| backend | `npm run typecheck` | Type-check without emitting |
| backend | `npm start` | Run the compiled app in `dist/` (used by Railway) |
| backend | `npm test` | Run the backend test suite (`node --test` via `tsx`) |
| backend | `npm run backup` | Take and upload a snapshot now |
| backend | `npm run restore` | Restore a snapshot over the live database |

## Implementation notes

- **Fonts** — Monocraft (OFL-1.1) lives in `frontend/public/fonts/`. Its programming
  ligatures are **disabled** in `frontend/src/index.css`: Monocraft merges multi-character
  sequences into single glyphs, which breaks per-character colouring and caret placement in
  the typing test. The font's design grid is 120/1080 em, so text is pixel-perfect at whole
  multiples of 9px (18px, 36px, 72px…).
- **Theming** — Tailwind v3. The `slate` and `amber` scales are overridden in
  `frontend/tailwind.config.ts` for the dark-mint + gold palette, and border radii are
  zeroed for squared corners. Chart and keyboard-heatmap colours are deliberately left as
  Tailwind defaults so that performance meaning (green → red) is preserved.
- **Auth** — Supabase issues the token; the backend verifies it with
  `supabase.auth.getUser(token)` on every protected route. Stats are scoped per user.
- **Practice mode** — targets the user's weakest bigrams, filtered to bigrams the word bank
  can actually produce, then builds a distinct word list so a test can never collapse into
  one word repeated.
