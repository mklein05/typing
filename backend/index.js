import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import morgan from 'morgan';

import {
  initDb,
  db,
  createSession,
  getAllSessions,
  getKeyStats,
  getBigramStats,
  getQuotes,
  invalidateBigramCache
} from './database.js';
import { requireAuth } from './auth.js';
import { generatePractice } from './practice.js';
import { runBackup, startBackupSchedule } from './backup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Constant-time compare, so the backup secret cannot be guessed by timing.
function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Setup database tables on startup
initDb();

// Middlewares
app.use(morgan('dev'));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Typing Test API', version: '1.0' });
});

app.post('/api/sessions', requireAuth, (req, res) => {
  try {
    const userId = req.userId;
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
    }

    const sessionId = createSession(req.body, userId);
    // A new session changes this user's bigram stats — drop the cached copy so
    // the next read recomputes instead of serving stale data.
    invalidateBigramCache(userId);
    res.status(201).json({ session_id: sessionId, message: 'Session saved successfully' });
  } catch (err) {
    console.error('[sessions] Save failed:', err);
    res.status(500).json({ detail: 'Failed to save session' });
  }
});

app.get('/api/sessions', requireAuth, (req, res) => {
  res.json(getAllSessions(req.userId));
});

app.get('/api/stats/keys', requireAuth, (req, res) => {
  res.json(getKeyStats(req.userId));
});

app.get('/api/stats/bigrams', requireAuth, (req, res) => {
  res.json(getBigramStats(req.userId));
});

app.get('/api/practice/generate', requireAuth, (req, res) => {
  const count = parseInt(req.query.count, 10) || 10;
  const wordCount = parseInt(req.query.word_count, 10) || 35;
  res.json(generatePractice(count, wordCount, req.userId));
});

app.post('/api/users/me', requireAuth, (req, res) => {
  const userId = req.userId;
  const email = req.body?.email || null;
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);

  if (!existing) {
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(userId, email);
  } else if (email) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
  }

  res.json({ user_id: userId, message: 'User ready' });
});

app.get('/api/users/username', requireAuth, (req, res) => {
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
  res.json({ username: row?.username || null });
});

app.post('/api/users/username', requireAuth, (req, res) => {
  const username = req.body?.username?.trim();
  if (!username || username.length < 2 || username.length > 20) {
    return res.status(400).json({ detail: 'Username must be between 2 and 20 characters' });
  }

  // Upsert, not a plain UPDATE. The users row is only created when the first
  // session is saved, so on a brand-new account the UPDATE matched 0 rows and
  // silently discarded the username — the app then re-prompted on every load.
  db.prepare(`
    INSERT INTO users (id, username) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET username = excluded.username
  `).run(req.userId, username);

  res.json({ username, message: 'Username set' });
});

// Public: seal facts are static seed content with no user data attached, so
// guests can use Quotes mode without an account. Every other route stays
// behind requireAuth.
app.get('/api/quotes', (req, res) => {
  const count = parseInt(req.query.count, 10) || 10;
  const category = req.query.category || 'seal';
  const difficulty = req.query.difficulty ? parseInt(req.query.difficulty, 10) : null;

  res.json(getQuotes(count, category, difficulty));
});

// Off-site backup trigger, for an external scheduler (Railway cron, GitHub
// Actions, cron-job.org). Uses a shared secret rather than a Supabase token so a
// scheduler never has to hold user credentials. Fails closed if unset.
app.post('/api/admin/backup', (req, res) => {
  const secret = process.env.BACKUP_SECRET;
  const provided = req.get('x-backup-secret') || '';

  if (!secret || !safeEqual(provided, secret)) {
    return res.status(401).json({ detail: 'Unauthorized' });
  }

  runBackup({ reason: 'http' })
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('[backup] trigger failed:', err);
      res.status(500).json({ detail: err.message });
    });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Starts the daily snapshot. Logs and returns when SUPABASE_SERVICE_ROLE_KEY is
// absent, so it is safe to leave in every environment.
startBackupSchedule();