// Resolving DB_PATH lives in its own module so restore.ts can locate the
// database WITHOUT opening it. Importing database.ts creates a live connection,
// and an open handle makes the atomic rename in restore.ts fail (EPERM on
// Windows, where a file cannot be replaced while any handle holds it).
//
// This module deliberately has no side effects: it does NOT load .env. Env is
// loaded by each entrypoint (`import 'dotenv/config'` as their first import),
// before any module here reads process.env. That keeps importing dbpath.ts safe
// in tests, which must never pick up the real .env and its DB_PATH.

import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

// TypeScript compiles into `dist/`, so after a build this module lives one level
// below the package root. Anchoring the default to the package root keeps the
// documented `backend/typing_test.db` location in both modes (`tsx` dev and
// compiled `node dist/index.js`) instead of silently moving it into `dist/`.
const packageDir = path.basename(moduleDir) === 'dist' ? path.dirname(moduleDir) : moduleDir;

// DB_PATH lets the database live outside the app directory. This is what makes
// a persistent Railway volume possible: mount a volume (e.g. at /data) and set
// DB_PATH=/data/typing_test.db. Without it the DB sits next to the code, and
// anything inside a container is discarded on every redeploy.
export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.DB_PATH || path.join(packageDir, 'typing_test.db');
}
