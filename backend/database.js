import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

import { resolveDbPath } from './dbpath.js';
import { SEAL_FACTS } from './sealFacts.js';
import {
  XP_PER_CORRECT,
  PRACTICE_MULTIPLIER,
  MAX_LEVEL,
  applyXp,
  levelFromXp,
  xpIntoLevel,
  xpForNextLevel,
  canPrestige,
} from './leveling.js';

const DB_PATH = resolveDbPath();

// better-sqlite3 will not create missing parent directories itself.
if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      username TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      started_at TEXT NOT NULL,
      wpm REAL NOT NULL,
      accuracy REAL NOT NULL,
      word_accuracy REAL,
      duration_seconds REAL NOT NULL,
      total_keystrokes INTEGER NOT NULL,
      total_words INTEGER NOT NULL,
      correct_words INTEGER NOT NULL,
      word_list TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS keystrokes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      sequence_num INTEGER NOT NULL,
      key_pressed TEXT NOT NULL,
      intended_key TEXT NOT NULL,
      correct INTEGER NOT NULL,
      pressed_at_ms REAL NOT NULL,
      released_at_ms REAL NOT NULL,
      word TEXT NOT NULL,
      word_index INTEGER NOT NULL,
      position_in_word INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_keystrokes_key ON keystrokes(key_pressed);
    CREATE INDEX IF NOT EXISTS idx_keystrokes_intended ON keystrokes(intended_key);

    -- The bigram analysis self-joins keystrokes on (session_id, sequence_num).
    -- With an index on session_id alone, SQLite scans every row in the session
    -- for each keystroke; covering sequence_num too turns that into an index
    -- seek (measured ~29x faster: 529ms -> 18ms on a 590k-row table).
    CREATE INDEX IF NOT EXISTS idx_keystrokes_session_seq
      ON keystrokes(session_id, sequence_num);

    -- Redundant now: idx_keystrokes_session_seq has the same leftmost column.
    DROP INDEX IF EXISTS idx_keystrokes_session;

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      source TEXT DEFAULT 'curated',
      category TEXT DEFAULT 'seal',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_category ON quotes(category);

    -- Retired: nothing ever filtered on difficulty, so the column and its index
    -- are dropped below. Removing the column requires removing the index first.
    DROP INDEX IF EXISTS idx_quotes_difficulty;

    -- Metered usage, one row per user per feature per period. The composite
    -- primary key is what makes "consume one unit" a single upsert.
    CREATE TABLE IF NOT EXISTS usage_counters (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      period_start TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, feature, period_start)
    );

    -- Generated practice passages, keyed by a hash of the target bigrams rather
    -- than by user. The text only depends on the bigram set, so this is shared
    -- across users and never goes stale. Token and cost columns exist so the
    -- real price of the feature can be measured rather than estimated.
    CREATE TABLE IF NOT EXISTS llm_passages (
      profile_key TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      bigrams TEXT NOT NULL,
      model TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      cost REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations for databases created before these columns existed.
  // SQLite has no ADD COLUMN IF NOT EXISTS, so these check first and are safe
  // to run on every boot.
  addColumnIfMissing('users', 'plan', "TEXT NOT NULL DEFAULT 'free'");
  addColumnIfMissing('users', 'premium_until', 'TEXT');

  // Experience and prestige. Level is derived from xp, never stored, so the
  // curve has one source of truth (backend/leveling.js).
  addColumnIfMissing('users', 'xp', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('users', 'prestige', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('users', 'lifetime_xp', 'INTEGER NOT NULL DEFAULT 0');

  // Whether a session was practice (2x XP) and what it actually awarded.
  addColumnIfMissing('sessions', 'mode', "TEXT NOT NULL DEFAULT 'normal'");
  addColumnIfMissing('sessions', 'xp_earned', 'INTEGER');

  // Must come after the DROP INDEX above: SQLite refuses to drop a column that
  // an index still references.
  dropColumnIfPresent('quotes', 'difficulty');

  seedQuotes();
}

/**
 * SQLite has no ADD COLUMN IF NOT EXISTS, so inspect the table first. Safe to
 * run on every boot, including against a database that already has the column.
 */
function addColumnIfMissing(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (existing.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * The inverse: drop a retired column, for databases created before it was
 * removed from the schema. Same "inspect first" approach, since SQLite has no
 * DROP COLUMN IF EXISTS either.
 *
 * Any index over the column must already be gone — SQLite rejects the ALTER with
 * "error in index ... after drop column" otherwise.
 */
function dropColumnIfPresent(table, column) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!existing.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  console.log(`[db] dropped ${table}.${column}`);
}

/**
 * Create the users row if it does not exist. Rows are created lazily on first
 * write, so anything that touches a brand-new account needs this first — the
 * usage counters have a foreign key to users.
 */
export function ensureUser(userId, email = null) {
  db.prepare(
    'INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO NOTHING'
  ).run(userId, email);
}

/** Correctly typed characters, excluding space and Backspace. */
export function countCorrectCharacters(keystrokes = []) {
  return keystrokes.filter((k) => k.correct && k.key !== ' ' && k.key !== 'Backspace').length;
}

export function createSession(data, userId = null) {
  const insertSession = db.prepare(`
    INSERT INTO sessions 
      (user_id, started_at, wpm, accuracy, word_accuracy, duration_seconds,
       total_keystrokes, total_words, correct_words, word_list, mode, xp_earned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertKeystroke = db.prepare(`
    INSERT INTO keystrokes
      (session_id, sequence_num, key_pressed, intended_key, correct,
       pressed_at_ms, released_at_ms, word, word_index, position_in_word)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const selectProgress = db.prepare('SELECT xp, lifetime_xp FROM users WHERE id = ?');
  const updateProgress = db.prepare('UPDATE users SET xp = ?, lifetime_xp = ? WHERE id = ?');

  // Transaction ensures the session, its keystrokes and the XP award all
  // succeed or fail together — XP can never be credited without its session.
  const transaction = db.transaction((data, userId) => {
    const keystrokes = data.keystrokes || [];
    const mode = data.mode === 'practice' ? 'practice' : 'normal';
    const multiplier = mode === 'practice' ? PRACTICE_MULTIPLIER : 1;
    const xpEarned = userId
      ? countCorrectCharacters(keystrokes) * XP_PER_CORRECT * multiplier
      : 0;

    let progress = null;
    if (userId) {
      const row = selectProgress.get(userId) ?? { xp: 0, lifetime_xp: 0 };
      progress = applyXp({ xp: row.xp, lifetimeXp: row.lifetime_xp }, xpEarned);
      updateProgress.run(progress.xp, progress.lifetimeXp, userId);
    }

    const wordListJson = JSON.stringify(data.word_list);
    const sessionResult = insertSession.run(
      userId,
      data.started_at,
      data.wpm,
      data.accuracy,
      data.word_accuracy ?? null,
      data.duration_seconds,
      data.total_keystrokes,
      data.total_words,
      data.correct_words,
      wordListJson,
      mode,
      userId ? xpEarned : null
    );

    const sessionId = sessionResult.lastInsertRowid;

    for (const k of keystrokes) {
      insertKeystroke.run(
        sessionId,
        k.sequence,
        k.key,
        k.intended,
        k.correct ? 1 : 0,
        k.pressed_at_ms,
        k.released_at_ms,
        k.word,
        k.word_index,
        k.position_in_word
      );
    }

    return {
      sessionId,
      xpEarned,
      level: progress?.level ?? null,
      leveledUp: progress?.leveledUp ?? false,
    };
  });

  return transaction(data, userId);
}

/** Derived level/prestige state for a user, ready to send to the client. */
export function getProfile(userId) {
  const row = db
    .prepare('SELECT username, xp, prestige, lifetime_xp FROM users WHERE id = ?')
    .get(userId);

  const xp = row?.xp ?? 0;
  const level = levelFromXp(xp);

  return {
    username: row?.username ?? null,
    level,
    prestige: row?.prestige ?? 0,
    xp,
    xp_into_level: xpIntoLevel(xp),
    xp_for_next_level: xpForNextLevel(level),
    lifetime_xp: row?.lifetime_xp ?? 0,
    can_prestige: canPrestige(xp),
    max_level: MAX_LEVEL,
  };
}

/**
 * Reset to level 1 and bump prestige. Only valid at MAX_LEVEL; returns null
 * otherwise so the route can reject it. XP earned at the cap is discarded.
 */
export function prestigeUser(userId) {
  const row = db.prepare('SELECT xp, prestige FROM users WHERE id = ?').get(userId);
  if (!row || !canPrestige(row.xp)) return null;

  const prestige = (row.prestige ?? 0) + 1;
  db.prepare('UPDATE users SET xp = 0, prestige = ? WHERE id = ?').run(prestige, userId);
  return { prestige };
}

export function getAllSessions(userId = null) {
  let rows;
  if (userId) {
    rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  } else {
    rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  }

  return rows.map((r) => ({
    ...r,
    word_list: JSON.parse(r.word_list)
  }));
}

const EXCLUDED_KEYS = ['', ' ', 'Backspace', 'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Enter', 'CapsLock'];

export function getKeyStats(userId = null) {
  const placeholders = EXCLUDED_KEYS.map(() => '?').join(',');
  const userFilter = userId ? 'AND k.session_id IN (SELECT id FROM sessions WHERE user_id = ?)' : '';
  const params = userId ? [...EXCLUDED_KEYS, userId] : [...EXCLUDED_KEYS];

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM keystrokes k
    WHERE k.intended_key NOT IN (${placeholders}) ${userFilter}
  `).get(...params);
  const totalAnalysed = totalRow ? totalRow.cnt : 0;

  const sessionRow = userId
    ? db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE user_id = ?').get(userId)
    : db.prepare('SELECT COUNT(*) AS cnt FROM sessions').get();
  const totalSessions = sessionRow ? sessionRow.cnt : 0;

  if (totalAnalysed === 0) {
    return { keys: [], total_keystrokes_analysed: 0, total_sessions: totalSessions };
  }

  const rows = db.prepare(`
    WITH lagged AS (
      SELECT
        k.intended_key,
        k.correct,
        k.pressed_at_ms,
        k.released_at_ms,
        LAG(k.pressed_at_ms) OVER (
          PARTITION BY k.session_id ORDER BY k.sequence_num
        ) AS prev_pressed_ms
      FROM keystrokes k
      WHERE k.intended_key NOT IN (${placeholders}) ${userFilter}
    )
    SELECT
      intended_key AS key,
      COUNT(*) AS total,
      SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS errors,
      ROUND(CAST(SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) AS error_rate,
      ROUND(AVG(pressed_at_ms - prev_pressed_ms), 2) AS avg_interkey_latency_ms,
      ROUND(AVG(released_at_ms - pressed_at_ms), 2) AS avg_hold_duration_ms
    FROM lagged
    WHERE prev_pressed_ms IS NOT NULL
    GROUP BY intended_key
    ORDER BY error_rate DESC
  `).all(...params);

  return {
    keys: rows,
    total_keystrokes_analysed: totalAnalysed,
    total_sessions: totalSessions
  };
}

function computeBigramStats(userId = null) {
  const placeholders = EXCLUDED_KEYS.map(() => '?').join(',');
  const userFilter = userId ? 'AND k1.session_id IN (SELECT id FROM sessions WHERE user_id = ?)' : '';
  const params = userId ? [...EXCLUDED_KEYS, ...EXCLUDED_KEYS, userId] : [...EXCLUDED_KEYS, ...EXCLUDED_KEYS];

  const sessionRow = userId
    ? db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE user_id = ?').get(userId)
    : db.prepare('SELECT COUNT(*) AS cnt FROM sessions').get();
  const totalSessions = sessionRow ? sessionRow.cnt : 0;

  const rows = db.prepare(`
    SELECT
      k1.intended_key || k2.intended_key AS bigram,
      COUNT(*) AS total_occurrences,
      SUM(CASE WHEN k2.correct = 0 THEN 1 ELSE 0 END) AS errors,
      ROUND(AVG(k2.pressed_at_ms - k1.pressed_at_ms), 2) AS avg_interkey_latency_ms
    FROM keystrokes k1
    JOIN keystrokes k2
      ON k1.session_id = k2.session_id
      AND k1.sequence_num + 1 = k2.sequence_num
      AND k1.word_index = k2.word_index
    WHERE k1.intended_key NOT IN (${placeholders})
      AND k2.intended_key NOT IN (${placeholders})
      ${userFilter}
    GROUP BY bigram
    HAVING COUNT(*) >= 3
    ORDER BY errors * 1.0 / COUNT(*) DESC
  `).all(...params);

  let totalOccurrencesSum = 0;
  const bigrams = rows.map((r) => {
    totalOccurrencesSum += r.total_occurrences;
    return {
      bigram: r.bigram,
      total_occurrences: r.total_occurrences,
      errors: r.errors,
      error_rate: r.total_occurrences > 0 ? Math.round((r.errors / r.total_occurrences) * 10000) / 100 : 0,
      avg_interkey_latency_ms: r.avg_interkey_latency_ms
    };
  });

  return {
    bigrams,
    total_bigrams_analysed: totalOccurrencesSum,
    total_unique_bigrams: bigrams.length,
    total_sessions: totalSessions
  };
}

// ─── Bigram stats cache ──────────────────────────────────────────────────
// The bigram analysis self-joins every keystroke, making it by far the most
// expensive query in the app. Its result only changes when a session is saved,
// so cache it per user and let the write path invalidate it explicitly.
const BIGRAM_CACHE_TTL_MS = 5 * 60 * 1000;
const bigramCache = new Map();

/** Drop cached bigram stats. Call after writing a session. */
export function invalidateBigramCache(userId = null) {
  if (userId === null || userId === undefined) bigramCache.clear();
  else bigramCache.delete(userId);
}

export function getBigramStats(userId = null) {
  const key = userId ?? '__all__';
  const cached = bigramCache.get(key);
  if (cached && Date.now() - cached.at < BIGRAM_CACHE_TTL_MS) return cached.value;

  const value = computeBigramStats(userId);
  bigramCache.set(key, { at: Date.now(), value });
  return value;
}

export function getQuotes(count = 10, category = 'seal') {
  const where = 'WHERE category = ?';
  const params = [category];

  const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM quotes ${where}`).get(...params);
  const total = totalRow ? totalRow.cnt : 0;
  if (total === 0) return { quotes: [], total_available: 0 };

  const rows = db.prepare(`
    SELECT id, text, source FROM quotes ${where}
    ORDER BY RANDOM() LIMIT ?
  `).all(...params, count);

  return { quotes: rows, total_available: total };
}

/**
 * Insert any seal facts the table does not already have.
 *
 * Deliberately additive rather than "seed only when the table is empty". The
 * first Node port shipped just the first seven facts, and an empty-table check
 * meant no existing database ever received the rest — the new facts existed in
 * source but were unreachable in practice. Matching on text makes this safe to
 * run on every boot, and safe to re-run after adding more facts.
 */
function seedQuotes() {
  const existing = db.prepare('SELECT 1 FROM quotes WHERE text = ?');
  const insert = db.prepare('INSERT INTO quotes (text) VALUES (?)');

  const insertMissing = db.transaction((facts) => {
    let added = 0;
    for (const fact of facts) {
      if (existing.get(fact)) continue;
      insert.run(fact);
      added += 1;
    }
    return added;
  });

  const added = insertMissing(SEAL_FACTS);
  if (added > 0) console.log(`[db] seeded ${added} seal facts`);
}