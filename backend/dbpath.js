// Resolving DB_PATH lives in its own module so restore.js can locate the
// database WITHOUT opening it. Importing database.js creates a live connection,
// and an open handle makes the atomic rename in restore.js fail (EPERM on
// Windows, where a file cannot be replaced while any handle holds it).
//
// This module deliberately has no side effects: it does NOT load .env. Env is
// loaded by each entrypoint (`import 'dotenv/config'` as their first import),
// before any module here reads process.env. That keeps importing dbpath.js safe
// in tests, which must never pick up the real .env and its DB_PATH.

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_PATH lets the database live outside the app directory. This is what makes
// a persistent Railway volume possible: mount a volume (e.g. at /data) and set
// DB_PATH=/data/typing_test.db. Without it the DB sits next to the code, and
// anything inside a container is discarded on every redeploy.
export function resolveDbPath(env = process.env) {
  return env.DB_PATH || path.join(__dirname, 'typing_test.db');
}
