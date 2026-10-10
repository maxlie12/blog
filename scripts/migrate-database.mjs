import './load-env.mjs';
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { databaseConfig } from './database.mjs';

const db = createClient(databaseConfig());
try {
  await db.execute('CREATE TABLE IF NOT EXISTS "_BlogMigration" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
  const applied = new Map((await db.execute('SELECT name, checksum FROM "_BlogMigration"')).rows.map(r => [r.name, r.checksum]));
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r => r.name);
  if (tables.includes('_prisma_migrations')) {
    const rows = (await db.execute('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows;
    for (const row of rows) applied.set(row.migration_name, row.checksum);
  } else if (!applied.size && tables.includes('Lesson')) {
    throw new Error('Existing database has no migration history. Back it up and reconcile its schema before running migrations.');
  }
  const directory = new URL('../prisma/migrations/', import.meta.url);
  const names = (await readdir(directory, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
  for (const name of names) {
    const sql = await readFile(new URL(`${name}/migration.sql`, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (applied.has(name)) {
      if (applied.get(name) !== checksum) throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    // Repository migrations contain simple DDL only. Refuse trigger bodies rather than split them incorrectly.
    if (/CREATE\s+TRIGGER|PRAGMA|BEGIN\s+TRANSACTION/i.test(sql)) throw new Error(`Migration requires manual transaction handling: ${name}`);
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    await db.batch([...statements, { sql: 'INSERT INTO "_BlogMigration" (name, checksum) VALUES (?, ?)', args: [name, checksum] }], 'write');
    console.log(`Applied ${name}`);
  }
  console.log('Database migrations complete.');
} finally {
  db.close();
}
