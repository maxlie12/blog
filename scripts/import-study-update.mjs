#!/usr/bin/env node
// Add new content without changing existing posts, lessons, attempts, or progress.
import { readFile } from 'node:fs/promises';
import './load-env.mjs';
import { createDatabase } from './database.mjs';

const prisma = createDatabase();
const payload = JSON.parse(await readFile(new URL('../content/study-update-20261010.json', import.meta.url), 'utf8'));

try {
  await prisma.$transaction(async (tx) => {
    const existingPost = await tx.post.findUnique({ where: { slug: payload.post.slug } });
    if (!existingPost) await tx.post.create({ data: payload.post });
    for (const lesson of payload.lessons) {
      const existing = await tx.lesson.findUnique({ where: { id: lesson.id } });
      if (!existing) await tx.lesson.create({ data: lesson });
    }
  });
  console.log('Study update imported: SmartOSC draft and two restart lessons. Existing content preserved.');
} finally {
  await prisma.$disconnect();
}
