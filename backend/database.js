import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

import { DB_PATH } from './dbpath.js';

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
      difficulty INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_category ON quotes(category);
    CREATE INDEX IF NOT EXISTS idx_quotes_difficulty ON quotes(difficulty);
  `);

  seedQuotes();
}

export function createSession(data, userId = null) {
  const insertSession = db.prepare(`
    INSERT INTO sessions 
      (user_id, started_at, wpm, accuracy, word_accuracy, duration_seconds,
       total_keystrokes, total_words, correct_words, word_list)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertKeystroke = db.prepare(`
    INSERT INTO keystrokes
      (session_id, sequence_num, key_pressed, intended_key, correct,
       pressed_at_ms, released_at_ms, word, word_index, position_in_word)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Transaction ensures both inserts succeed or fail together
  const transaction = db.transaction((data, userId) => {
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
      wordListJson
    );

    const sessionId = sessionResult.lastInsertRowid;

    for (const k of data.keystrokes) {
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

    return sessionId;
  });

  return transaction(data, userId);
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

export function getQuotes(count = 10, category = 'seal', difficulty = null) {
  let where = 'WHERE category = ?';
  const params = [category];
  if (difficulty !== null) {
    where += ' AND difficulty = ?';
    params.push(difficulty);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM quotes ${where}`).get(...params);
  const total = totalRow ? totalRow.cnt : 0;
  if (total === 0) return { quotes: [], total_available: 0 };

  const rows = db.prepare(`
    SELECT id, text, source, difficulty FROM quotes ${where}
    ORDER BY RANDOM() LIMIT ?
  `).all(...params, count);

  return { quotes: rows, total_available: total };
}

function seedQuotes() {
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM quotes').get();
  if (countRow.cnt === 0) {
    const insert = db.prepare('INSERT INTO quotes (text, difficulty) VALUES (?, ?)');
    const insertMany = db.transaction((quotes) => {
      for (const q of quotes) insert.run(q.text, q.difficulty);
    });
    insertMany(SEAL_FACTS);
  }
}

export const SEAL_FACTS = [
  { text: "Seals are pinnipeds, a group of marine mammals that also includes sea lions and walruses.", difficulty: 2 },
  { text: "There are 33 species of seals found across the world, from the Arctic to the Antarctic.", difficulty: 2 },
  { text: "The largest seal species is the southern elephant seal. Males can weigh up to 4,000 kilograms!", difficulty: 3 },
  { text: "Harbour seals can hold their breath for up to 30 minutes while diving for food.", difficulty: 2 },
  { text: "Seals have a thick layer of blubber under their skin that keeps them warm in freezing waters.", difficulty: 2 },
  { text: "Unlike dolphins and whales, seals give birth on land or ice, not in the water.", difficulty: 2 },
  { text: "The word 'pinniped' comes from Latin, meaning 'fin-footed' or 'wing-footed'.", difficulty: 2 }
];