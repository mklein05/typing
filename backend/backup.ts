// Off-site database backups.
//
// The SQLite file lives on a Railway volume. A volume survives redeploys, but
// nothing copies it anywhere: if that volume is corrupted, detached, or deleted,
// every session and every keystroke goes with it. This module snapshots the
// database and ships the snapshot to Supabase Storage, so the loss becomes
// recoverable.
//
// Snapshots are taken with SQLite's Online Backup API (db.backup), which is safe
// while the app is actively writing. Do NOT fs.copyFile the .db file: a write in
// flight can produce a torn file that still opens without complaint and is
// quietly missing rows.

// First import: `npm run backup` is its own entrypoint, so it must load .env
// itself now that dbpath.ts no longer does it as a side effect.
import 'dotenv/config';

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const PREFIX = 'typing_test-';

// Supabase's default per-object limit on the free tier.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** A snapshot object as listed from Supabase Storage. */
export interface BackupFile {
  name: string;
  created_at: string | null;
  metadata?: { size?: number } | null;
}

/** A completed snapshot. */
export interface BackupResult {
  name: string;
  reason: string;
  bytes: number;
  sessions: number;
  keystrokes: number;
  integrity: unknown;
  pruned: number;
  durationMs: number;
}

/** Either a completed snapshot or a skip notice when backups are unconfigured. */
export type BackupRun = BackupResult | { skipped: true; reason: string };

type AdminClient = ReturnType<typeof createClient>;

/**
 * Snapshots are filed under a folder per environment, so a snapshot taken on a
 * laptop can never be confused with — or restored over — production. Railway
 * sets RAILWAY_ENVIRONMENT_NAME inside containers, so a deploy labels itself
 * with no extra configuration.
 */
export const backupLabel = (): string =>
  (process.env.BACKUP_LABEL || process.env.RAILWAY_ENVIRONMENT_NAME || 'local')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase() || 'local';

const folder = (): string => backupLabel();

// Read through functions rather than at module scope: index.ts imports this
// module before dotenv has run, so top-level reads would see undefined.
const bucket = (): string => process.env.BACKUP_BUCKET || 'db-backups';
const retentionDays = (): number => Number(process.env.BACKUP_RETENTION_DAYS || 14);
const intervalHours = (): number => Number(process.env.BACKUP_INTERVAL_HOURS || 24);

let admin: AdminClient | null = null;

function getAdmin(): AdminClient | null {
  if (admin) return admin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // Service role bypasses row-level security, so this client is server-side
  // only and the key must never reach the browser.
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** True when a snapshot could be taken: a real file DB plus storage credentials. */
export function backupsEnabled(): boolean {
  return process.env.DB_PATH !== ':memory:' && getAdmin() !== null;
}

/** Snapshots for this environment, newest first. */
export async function listBackups(): Promise<BackupFile[]> {
  const supabase = getAdmin();
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  const { data, error } = await supabase.storage
    .from(bucket())
    .list(folder(), { limit: 1000 });
  if (error) throw new Error(`list failed: ${error.message}`);

  return ((data || []) as unknown as BackupFile[])
    .filter((f) => f.name.startsWith(PREFIX) && f.name.endsWith('.db'))
    // Names begin with an ISO timestamp, so lexical order is chronological.
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Download a snapshot by name. */
export async function downloadBackup(name: string): Promise<Buffer> {
  const supabase = getAdmin();
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  const { data, error } = await supabase.storage.from(bucket()).download(`${folder()}/${name}`);
  if (error) throw new Error(`download failed: ${error.message}`);

  return Buffer.from(await data.arrayBuffer());
}

let inFlight: Promise<BackupRun> | null = null;

/**
 * Take a snapshot and upload it. Safe to call from a timer, an HTTP route, or
 * the CLI; concurrent calls collapse into the one already running.
 */
export async function runBackup({ reason = 'manual' }: { reason?: string } = {}): Promise<BackupRun> {
  if (!backupsEnabled()) {
    return { skipped: true, reason: 'set SUPABASE_SERVICE_ROLE_KEY to enable backups' };
  }
  if (inFlight) return inFlight;

  inFlight = takeSnapshot(reason).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function takeSnapshot(reason: string): Promise<BackupResult> {
  const startedAt = Date.now();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${PREFIX}${stamp}.db`;
  const tmp = path.join(os.tmpdir(), name);

  try {
    // Imported lazily, so that merely importing this module does not open a
    // connection. restore.ts imports it, and an open handle on the database
    // would block the atomic rename that replaces that file.
    const { db } = await import('./database.js');
    await db.backup(tmp); // atomic; safe with concurrent writers

    const bytes = fs.statSync(tmp).size;

    // Verify the copy before trusting it. A snapshot that silently contains
    // nothing is worse than no snapshot at all, because it looks like safety.
    const copy = new Database(tmp, { readonly: true, fileMustExist: true });
    let integrity: unknown;
    let sessions = 0;
    let keystrokes = 0;
    try {
      integrity = copy.pragma('integrity_check', { simple: true });
      sessions = copy.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM sessions').get()?.n ?? 0;
      keystrokes = copy.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM keystrokes').get()?.n ?? 0;
    } finally {
      copy.close();
    }

    if (integrity !== 'ok') throw new Error(`integrity_check failed: ${integrity}`);
    if (bytes > MAX_UPLOAD_BYTES) {
      throw new Error(
        `snapshot is ${(bytes / 1048576).toFixed(1)} MB, over the ${
          MAX_UPLOAD_BYTES / 1048576
        } MB upload limit`
      );
    }

    const supabase = getAdmin();
    if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    const { error } = await supabase.storage
      .from(bucket())
      .upload(`${folder()}/${name}`, fs.readFileSync(tmp), {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(`upload failed: ${error.message}`);

    const pruned = await prune(supabase);
    const durationMs = Date.now() - startedAt;

    console.log(
      `[backup] ${name} — ${(bytes / 1024).toFixed(0)} KB, ${sessions} sessions, ` +
        `${keystrokes} keystrokes, pruned ${pruned}, ${durationMs}ms (${reason})`
    );

    return { name, reason, bytes, sessions, keystrokes, integrity, pruned, durationMs };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function prune(supabase: AdminClient): Promise<number> {
  // Only ever prune this environment's folder, so production can never delete a
  // laptop's snapshots, or the other way round.
  const { data, error } = await supabase.storage.from(bucket()).list(folder(), { limit: 1000 });
  if (error || !data) return 0;

  const snapshots = (data as unknown as BackupFile[])
    .filter((f) => f.name.startsWith(PREFIX) && f.name.endsWith('.db'))
    .sort((a, b) => b.name.localeCompare(a.name));

  const cutoff = Date.now() - retentionDays() * 86400000;

  // slice(1) keeps the newest snapshot no matter what retention says, and the
  // Number.isFinite guard means an unparseable timestamp is never deleted.
  const stale = snapshots
    .slice(1)
    .filter((f) => {
      const when = Date.parse(f.created_at ?? '');
      return Number.isFinite(when) && when < cutoff;
    })
    .map((f) => f.name);

  if (stale.length === 0) return 0;

  const { error: removeError } = await supabase.storage
    .from(bucket())
    .remove(stale.map((n) => `${folder()}/${n}`));
  if (removeError) {
    console.error('[backup] prune failed:', removeError.message);
    return 0;
  }
  return stale.length;
}

/** Start the in-process schedule. No-ops with a log line when unconfigured. */
export function startBackupSchedule(): void {
  if (!backupsEnabled()) {
    console.log('[backup] disabled — set SUPABASE_SERVICE_ROLE_KEY to enable');
    return;
  }

  const everyMs = intervalHours() * 3600000;

  const tick = (): void => {
    runBackup({ reason: 'scheduled' }).catch((err: unknown) =>
      console.error('[backup] failed:', err instanceof Error ? err.message : err)
    );
  };

  // A restart can land either side of the timer, and a redeploy resets it. Take
  // a snapshot on boot when the newest one is already older than the interval,
  // otherwise a service that restarts often can go a long time with no backup.
  setTimeout(async () => {
    try {
      const newest = (await listBackups())[0];
      const age = newest?.created_at ? Date.now() - Date.parse(newest.created_at) : null;
      if (age === null || !Number.isFinite(age) || age > everyMs) tick();
    } catch (err) {
      console.error('[backup] startup check failed:', err instanceof Error ? err.message : err);
    }
  }, 60_000).unref();

  setInterval(tick, everyMs).unref();

  console.log(`[backup] every ${intervalHours()}h → ${bucket()} (retain ${retentionDays()}d)`);
}

// `npm run backup` for an on-demand snapshot.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBackup({ reason: 'cli' })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit('skipped' in result ? 1 : 0);
    })
    .catch((err: unknown) => {
      console.error('[backup] failed:', err);
      process.exit(1);
    });
}
