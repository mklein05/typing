// Must be the first import: ESM evaluates imports in order, so loading .env here
// guarantees it is loaded before ./database.ts and ./auth.ts read process.env.
import 'dotenv/config';

import { initDb } from './database.js';
import { requireAuth } from './auth.js';
import { createApp } from './app.js';
import { startBackupSchedule } from './backup.js';

const PORT = process.env.PORT || 8000;

// Setup database tables on startup
initDb();

const app = createApp({ requireAuth });

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Starts the daily snapshot. Logs and returns when SUPABASE_SERVICE_ROLE_KEY is
// absent, so it is safe to leave in every environment.
startBackupSchedule();
