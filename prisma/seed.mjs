#!/usr/bin/env node
// One-time seed: carries the lessons/journey that used to live in the client-only
// src/data/lessons.ts and src/data/journey.ts prototypes into the real database, so nothing
// is lost when Studio becomes the source of truth. Safe to re-run (skips existing rows).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const lessons = [
  {
    skill: "speaking",
    title: "Interview: Tell me about yourself",
    level: "B1+",
    instructions:
      "Record a 60-90 second self-introduction for a frontend developer interview. Cover: your background, what you focus on now, and one project you're proud of.",
    material: null,
    exercises: "Record a 60-90 second self-introduction.",
    completionCriteria: "A recorded or written self-introduction covering background, current focus, and one project.",
  },
  {
    skill: "listening",
    title: "Listening: Team stand-up",
    level: "B1-B2",
    instructions:
      "Listen to (imagine) a 2-minute team stand-up where a teammate describes a blocked ticket. Note: what is blocked, who owns the next step, and by when.",
    material: null,
    exercises: "Take notes answering: what's blocked, who owns it, by when.",
    completionCriteria: "Notes identify the blocker, owner, and next-step deadline.",
  },
  {
    skill: "reading",
    title: "Reading: Tech article",
    level: "B2",
    instructions:
      "Read a short article about how AI coding assistants change day-to-day engineering work. Write a 3-sentence summary of the main argument.",
    material: null,
    exercises: "Write a 3-sentence summary of the article's main argument.",
    completionCriteria: "A 3-sentence summary capturing the article's central claim.",
  },
  {
    skill: "writing",
    title: "Writing: A day in my life",
    level: "B1+",
    instructions: "Write 120-150 words describing a typical workday, from morning to evening.",
    material: null,
    exercises: "Write 120-150 words about a typical workday.",
    completionCriteria: "120-150 words covering morning through evening.",
  },
  {
    skill: "writing",
    title: "Writing: Reflect on a recent challenge",
    level: "B2",
    instructions:
      "Write about a recent technical or communication challenge: what happened, what you tried, and what you'd do differently.",
    material: null,
    exercises: "Write ~150 words reflecting on a recent challenge.",
    completionCriteria: "Reflection covers what happened, what was tried, and what would change next time.",
  },
  {
    skill: "speaking",
    title: "Speaking: Record a 1-minute self-introduction",
    level: "B1-B2",
    instructions: "Record yourself introducing your current project (Atlas) to a new teammate in under 60 seconds.",
    material: null,
    exercises: "Record a under-60-second introduction to your current project.",
    completionCriteria: "A recording under 60 seconds introducing the current project.",
  },
];

const checkpoints = [
  { label: "B1+", title: "Base camp — comfortable with everyday conversation", order: 0, optional: false, isCurrent: true },
  { label: "B2", title: "More natural, flexible conversations", order: 1, optional: false, isCurrent: false },
  { label: "C1", title: "Confident and flexible use", order: 2, optional: false, isCurrent: false },
  { label: "C2", title: "Optional peak — lifelong learning", order: 3, optional: true, isCurrent: false },
];

async function main() {
  const existingLessons = await prisma.lesson.count();
  if (existingLessons === 0) {
    for (const lesson of lessons) {
      await prisma.lesson.create({ data: lesson });
    }
    console.log(`Seeded ${lessons.length} lessons.`);
  } else {
    console.log(`Skipped lesson seed — ${existingLessons} lessons already exist.`);
  }

  const existingCheckpoints = await prisma.journeyCheckpoint.count();
  if (existingCheckpoints === 0) {
    for (const checkpoint of checkpoints) {
      await prisma.journeyCheckpoint.create({ data: checkpoint });
    }
    console.log(`Seeded ${checkpoints.length} journey checkpoints.`);
  } else {
    console.log(`Skipped journey seed — ${existingCheckpoints} checkpoints already exist.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
