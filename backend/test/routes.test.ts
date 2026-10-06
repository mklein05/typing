import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { RequestHandler } from 'express';

// Must be set before ./database.ts is evaluated: it opens the DB at import.
// dotenv never overrides an already-set variable, so this survives the .env
// load that happens below.
process.env.DB_PATH = ':memory:';

const { initDb, db } = await import('../database.js');
const { createApp } = await import('../app.js');
const { consumeQuota } = await import('../entitlements.js');
const { MAX_XP } = await import('../leveling.js');

// app.ts imports backup.ts, whose first import is 'dotenv/config' — so loading
// the app pulls in .env as a side effect. Clear the values these tests depend on
// being unset *after* that import, not before.
delete process.env.LLM_MODEL;
delete process.env.OPENROUTER_API_KEY;
delete process.env.BACKUP_SECRET;
delete process.env.FREE_LLM_DAILY_LIMIT;

initDb();

// Stub for the Supabase-backed requireAuth: a header stands in for the token,
// so the tests exercise the real routing without a real JWT.
const requireAuth: RequestHandler = (req, res, next) => {
  const id = req.get('x-test-user');
  if (!id) {
    res.status(401).json({ detail: 'Missing or invalid token format' });
    return;
  }
  req.userId = id;
  next();
};

const app = createApp({ requireAuth, logRequests: false });

let server: Server;
let base = '';

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

function authedFetch(userId: string, path: string, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-test-user': userId },
  });
}

function postJson(userId: string, path: string, body: unknown) {
  return authedFetch(userId, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function keystroke(
  sequence: number,
  key: string,
  intended: string,
  correct: boolean,
  position = 0
) {
  return {
    sequence,
    key,
    intended,
    correct,
    pressed_at_ms: sequence * 100,
    released_at_ms: sequence * 100 + 40,
    word: 'at',
    word_index: 0,
    position_in_word: position,
  };
}

function sessionBody(overrides: Record<string, unknown> = {}) {
  const keystrokes = [
    keystroke(0, 'a', 'a', true),
    keystroke(1, 't', 't', true),
    keystroke(2, 'x', 'x', false),
    keystroke(3, ' ', ' ', true, 2),
  ];
  return {
    started_at: '2026-01-15T10:00:00.000Z',
    wpm: 50,
    accuracy: 90,
    word_accuracy: 80,
    duration_seconds: 10,
    total_keystrokes: keystrokes.length,
    total_words: 1,
    correct_words: 1,
    word_list: ['at'],
    keystrokes,
    ...overrides,
  };
}

test('GET /api/quotes is public', async () => {
  const res = await fetch(`${base}/api/quotes?count=1`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { quotes: unknown[] };
  assert.equal(body.quotes.length, 1);
});

test('authenticated routes reject a request with no user', async () => {
  const res = await fetch(`${base}/api/profile`);
  assert.equal(res.status, 401);
});

test('GET /api/profile returns the derived level shape', async () => {
  const res = await authedFetch('routes-profile', '/api/profile');
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.level, 1);
  assert.equal(body.prestige, 0);
  assert.ok('xp_for_next_level' in body);
});

test('POST /api/sessions awards XP, doubled in practice', async () => {
  const normal = await postJson('routes-normal', '/api/sessions', sessionBody());
  assert.equal(normal.status, 201);
  const normalBody = (await normal.json()) as { xp_earned: number };
  assert.equal(normalBody.xp_earned, 2); // two correct letters; space excluded

  const practice = await postJson(
    'routes-practice',
    '/api/sessions',
    sessionBody({ mode: 'practice' })
  );
  assert.equal(practice.status, 201);
  const practiceBody = (await practice.json()) as { xp_earned: number };
  assert.equal(practiceBody.xp_earned, 4);
});

test('XP from a saved session is reflected on the profile', async () => {
  const res = await authedFetch('routes-normal', '/api/profile');
  const body = (await res.json()) as { xp: number };
  assert.equal(body.xp, 2);
});

test('prestige is rejected below level 100 and accepted at it', async () => {
  const below = await authedFetch('routes-prestige', '/api/prestige', { method: 'POST' });
  assert.equal(below.status, 400);

  db.prepare('UPDATE users SET xp = ? WHERE id = ?').run(MAX_XP, 'routes-prestige');
  const atCap = await authedFetch('routes-prestige', '/api/prestige', { method: 'POST' });
  assert.equal(atCap.status, 200);
  const body = (await atCap.json()) as { prestige: number; level: number };
  assert.equal(body.prestige, 1);
  assert.equal(body.level, 1);
});

test('AI practice falls back gracefully with no model configured', async () => {
  // The deterministic generator needs a saved session before it can target
  // anything, so reuse the user created earlier.
  const res = await authedFetch('routes-normal', '/api/practice/generate-llm', {
    method: 'POST',
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { engine: string; quota?: unknown };
  assert.equal(body.engine, 'fallback');
  assert.ok('quota' in body);
});

test('AI practice is rate limited once the daily allowance is spent', async () => {
  const user = 'routes-quota';
  consumeQuota(user, 'llm_practice');
  consumeQuota(user, 'llm_practice');
  consumeQuota(user, 'llm_practice');

  const res = await authedFetch(user, '/api/practice/generate-llm', { method: 'POST' });
  assert.equal(res.status, 429);
});

test('the backup endpoint fails closed without a secret', async () => {
  const res = await fetch(`${base}/api/admin/backup`, { method: 'POST' });
  assert.equal(res.status, 401);
});
