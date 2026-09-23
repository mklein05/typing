import { test } from 'node:test';
import assert from 'node:assert/strict';

// Must be set before ./database.js is evaluated: it opens the DB at import.
process.env.DB_PATH = ':memory:';

const {
  initDb,
  db,
  ensureUser,
  createSession,
  getAllSessions,
  getKeyStats,
  getBigramStats,
  getProfile,
  prestigeUser,
  invalidateBigramCache,
} = await import('../database.js');
const { MAX_XP } = await import('../leveling.js');

initDb();

// sessions.user_id has a foreign key to users, and the real route creates the
// users row before saving. Tests have to do the same.
function saveSession(userId, data) {
  ensureUser(userId);
  return createSession(data, userId).sessionId;
}

function keystroke(seq, key, intended, correct, word, wordIndex, position) {
  return {
    sequence: seq,
    key,
    intended,
    correct,
    pressed_at_ms: seq * 100,
    released_at_ms: seq * 100 + 40,
    word,
    word_index: wordIndex,
    position_in_word: position,
  };
}

function sessionData(keystrokes, overrides = {}) {
  return {
    started_at: '2026-01-15T10:00:00.000Z',
    wpm: 50,
    accuracy: 95,
    word_accuracy: 90,
    duration_seconds: 12,
    total_keystrokes: keystrokes.length,
    total_words: 2,
    correct_words: 1,
    word_list: ['at', 'cat'],
    keystrokes,
    ...overrides,
  };
}

test('createSession stores the session and its keystrokes in one transaction', () => {
  const keystrokes = [
    keystroke(0, 'a', 'a', true, 'at', 0, 0),
    keystroke(1, 't', 't', true, 'at', 0, 1),
  ];
  const id = saveSession('db-user-1', sessionData(keystrokes));

  const row = getAllSessions('db-user-1').find((s) => s.id === id);
  assert.ok(row);
  assert.deepEqual(row.word_list, ['at', 'cat']); // JSON column round-trips
  assert.equal(row.wpm, 50);

  const count = db.prepare('SELECT COUNT(*) AS n FROM keystrokes WHERE session_id = ?').get(id).n;
  assert.equal(count, 2);
});

test('getKeyStats aggregates per-key errors and skips non-typing keys', () => {
  const keystrokes = [
    keystroke(0, 'a', 'a', true, 'at', 0, 0),
    keystroke(1, 'a', 'a', true, 'at', 0, 0),
    keystroke(2, 't', 't', false, 'at', 0, 1),
    keystroke(3, ' ', ' ', true, 'at', 0, 2), // space is excluded from analysis
  ];
  saveSession('db-user-2', sessionData(keystrokes));

  const stats = getKeyStats('db-user-2');
  assert.equal(stats.total_sessions, 1);
  assert.equal(stats.total_keystrokes_analysed, 3);

  const t = stats.keys.find((k) => k.key === 't');
  assert.ok(t);
  assert.equal(t.errors, 1);
  assert.equal(t.error_rate, 100);

  const a = stats.keys.find((k) => k.key === 'a');
  assert.ok(a);
  assert.equal(a.errors, 0);
});

test('getBigramStats joins consecutive keystrokes and enforces the min count', () => {
  const keystrokes = [
    keystroke(0, 'a', 'a', true, 'at', 0, 0),
    keystroke(1, 't', 't', true, 'at', 0, 1),
    keystroke(2, 'a', 'a', true, 'at', 0, 0),
    keystroke(3, 't', 't', true, 'at', 0, 1),
    keystroke(4, 'a', 'a', true, 'at', 0, 0),
    keystroke(5, 't', 't', false, 'at', 0, 1),
  ];
  saveSession('db-user-3', sessionData(keystrokes));

  const stats = getBigramStats('db-user-3');
  const at = stats.bigrams.find((b) => b.bigram === 'at');
  assert.ok(at);
  assert.equal(at.total_occurrences, 3);
  assert.equal(at.errors, 1);
  assert.equal(at.error_rate, 33.33);
  // "ta" occurs only twice, below the >= 3 threshold, so it is not reported.
  assert.equal(stats.total_bigrams_analysed, 3);
});

test('saving a session awards one XP per correct character', () => {
  const keystrokes = [
    keystroke(0, 'a', 'a', true, 'at', 0, 0),
    keystroke(1, 't', 't', true, 'at', 0, 1),
    keystroke(2, 'x', 'x', false, 'at', 0, 0), // wrong key: no XP
    keystroke(3, ' ', ' ', true, 'at', 0, 2), // space: no XP
    keystroke(4, 'Backspace', 'Backspace', false, 'at', 0, 0), // no XP
  ];
  saveSession('xp-user-1', sessionData(keystrokes));

  const profile = getProfile('xp-user-1');
  assert.equal(profile.xp, 2);
  assert.equal(profile.level, 1);
  assert.equal(profile.lifetime_xp, 2);
});

test('practice sessions award double XP and record the mode', () => {
  const keystrokes = [
    keystroke(0, 'a', 'a', true, 'at', 0, 0),
    keystroke(1, 't', 't', true, 'at', 0, 1),
  ];
  saveSession('xp-user-2', sessionData(keystrokes, { mode: 'practice' }));

  assert.equal(getProfile('xp-user-2').xp, 4);
  const row = db.prepare('SELECT mode, xp_earned FROM sessions WHERE user_id = ?').get('xp-user-2');
  assert.equal(row.mode, 'practice');
  assert.equal(row.xp_earned, 4);
});

test('getProfile derives the level from stored XP', () => {
  const user = 'xp-user-3';
  ensureUser(user);
  // 10 XP reaches level 2, so 25 XP leaves 15 into the level.
  db.prepare('UPDATE users SET xp = 25 WHERE id = ?').run(user);

  const profile = getProfile(user);
  assert.equal(profile.level, 2);
  assert.equal(profile.xp_into_level, 15);
  assert.equal(profile.xp_for_next_level, 30);
  assert.equal(profile.can_prestige, false);
});

test('prestige is rejected below the cap and resets XP at it', () => {
  const user = 'xp-user-prestige';
  ensureUser(user);

  assert.equal(prestigeUser(user), null); // not eligible yet

  db.prepare('UPDATE users SET xp = ?, lifetime_xp = 500000 WHERE id = ?').run(MAX_XP, user);
  assert.equal(getProfile(user).can_prestige, true);

  const result = prestigeUser(user);
  assert.ok(result);
  assert.equal(result.prestige, 1);

  const profile = getProfile(user);
  assert.equal(profile.level, 1);
  assert.equal(profile.xp, 0);
  assert.equal(profile.prestige, 1);
  assert.equal(profile.lifetime_xp, 500000); // lifetime survives the reset
});

test('bigram stats are cached until the cache is invalidated', () => {
  const user = 'db-user-cache';
  saveSession(
    user,
    sessionData([keystroke(0, 'a', 'a', true, 'at', 0, 0), keystroke(1, 't', 't', true, 'at', 0, 1)])
  );

  const first = getBigramStats(user);
  const second = getBigramStats(user);
  assert.equal(first, second); // served from cache

  invalidateBigramCache(user);
  assert.notEqual(first, getBigramStats(user)); // recomputed
});
