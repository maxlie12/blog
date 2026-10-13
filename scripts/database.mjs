import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

export function databaseConfig(env = process.env) {
  if (env.BLOG_READ_ONLY_PREVIEW === '1') {
    // The bundled database contains schema only, never learner records.
    const source = resolve(process.cwd(), 'data/preview.db');
    mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
    if (!existsSync(source)) return { url: `file:${source}` }; // first preview build migration
    const temporary = resolve(tmpdir(), 'maxlie-blog-read-only-preview.db');
    if (!existsSync(temporary)) copyFileSync(source, temporary);
    return { url: `file:${temporary}` };
  }
  const url = env.TURSO_DATABASE_URL;
  if (url) {
    if (!/^libsql:\/\//.test(url)) throw new Error('TURSO_DATABASE_URL must use libsql://.');
    if (!env.TURSO_AUTH_TOKEN) throw new Error('TURSO_AUTH_TOKEN is required.');
    return { url, authToken: env.TURSO_AUTH_TOKEN };
  }
  if (env.VERCEL) throw new Error('Configure Turso before deploying: local SQLite is not persistent on Vercel.');
  const local = env.DATABASE_URL || 'file:../data/blog.db';
  if (!local.startsWith('file:')) throw new Error('For local development use a file: DATABASE_URL.');
  const prismaDirectory = resolve(process.cwd(), 'prisma');
  return { url: `file:${resolve(prismaDirectory, local.slice(5))}` };
}

export function createDatabase() {
  const adapter = new PrismaLibSQL(databaseConfig(), { timestampFormat: 'unixepoch-ms' });
  return new PrismaClient({ adapter });
}
