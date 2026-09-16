// Resolving DB_PATH lives in its own module so restore.js can locate the
// database WITHOUT opening it. Importing database.js creates a live connection,
// and an open handle makes the atomic rename in restore.js fail (EPERM on
// Windows, where a file cannot be replaced while any handle holds it).

// Loaded here rather than only in index.js: ESM evaluates imports before the
// importing module's body, so `dotenv.config()` in index.js runs *after* the
// value below has been read.
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_PATH lets the database live outside the app directory. This is what makes
// a persistent Railway volume possible: mount a volume (e.g. at /data) and set
// DB_PATH=/data/typing_test.db. Without it the DB sits next to the code, and
// anything inside a container is discarded on every redeploy.
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'typing_test.db');
