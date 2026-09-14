// Restore a snapshot from Supabase Storage over the live database file.
//
// Run this INSIDE the deployed container, not on your laptop — locally it would
// overwrite your dev database instead of the Railway volume:
//
//     railway ssh --service backend
//     node restore.js --list
//     node restore.js                       # newest snapshot
//     node restore.js typing_test-2026-09-14T02-00-00-000Z.db
//
// Then restart the backend service so it reopens the replaced file. The running
// process keeps its old handle until then, which is what you want: nothing is
// swapped out from under a live request.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { DB_PATH } from './database.js';
import { listBackups, downloadBackup } from './backup.js';

const wanted = process.argv[2];

async function main() {
  const snapshots = await listBackups();

  if (snapshots.length === 0) {
    console.error('No snapshots in the bucket. Nothing to restore.');
    process.exit(1);
  }

  if (wanted === '--list') {
    console.log(`Snapshots available for ${DB_PATH}:`);
    for (const s of snapshots) {
      const kb = ((s.metadata?.size ?? 0) / 1024).toFixed(0);
      console.log(`  ${s.name}  ${kb} KB  ${s.created_at}`);
    }
    return;
  }

  const target = wanted || snapshots[0].name;
  if (!snapshots.some((s) => s.name === target)) {
    console.error(`No such snapshot: ${target} (use --list to see them)`);
    process.exit(1);
  }

  console.log(`Downloading ${target} ...`);
  const bytes = await downloadBackup(target);
  console.log(`  ${(bytes.length / 1024).toFixed(0)} KB`);

  // Verify before touching the live file. Restoring a corrupt snapshot over a
  // good database turns one problem into two.
  const staging = `${DB_PATH}.incoming`;
  fs.writeFileSync(staging, bytes);

  const check = new Database(staging, { readonly: true, fileMustExist: true });
  let integrity;
  let sessions;
  let keystrokes;
  try {
    integrity = check.pragma('integrity_check', { simple: true });
    sessions = check.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
    keystrokes = check.prepare('SELECT COUNT(*) AS n FROM keystrokes').get().n;
  } finally {
    check.close();
  }

  if (integrity !== 'ok') {
    fs.rmSync(staging, { force: true });
    console.error(`Snapshot is corrupt (${integrity}). Live database untouched.`);
    process.exit(1);
  }
  console.log(`  verified: ${sessions} sessions, ${keystrokes} keystrokes`);

  // Keep the current file, so a mistaken restore is itself reversible.
  if (fs.existsSync(DB_PATH)) {
    const aside = `${DB_PATH}.pre-restore-${Date.now()}`;
    fs.copyFileSync(DB_PATH, aside);
    console.log(`Previous database kept at ${path.basename(aside)}`);
  }

  fs.renameSync(staging, DB_PATH); // atomic swap within the same directory
  console.log(`Restored ${target} → ${DB_PATH}`);
  console.log('Now restart the backend service so it reopens the file.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
