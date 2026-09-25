#!/usr/bin/env node
/**
 * Add one LearningLog entry from the terminal.
 * Usage:
 *   npm run log -- --area=english --activity="Shadowing practice" --minutes=20 --note="..." --private
 *   npm run log -- --area=dev --activity="Refactored streak calc" --date=2026-09-20
 *
 * See docs/OPERATIONS.md for the full flag reference.
 */
import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const out = { isPublic: true };
  for (const arg of argv) {
    if (arg === "--private") {
      out.isPublic = false;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function todayInTz(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.area || !args.activity) {
    console.error(
      'Missing required flags. Example:\n  npm run log -- --area=english --activity="Shadowing practice"'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const entry = await prisma.learningLog.create({
      data: {
        date: args.date || todayInTz(process.env.SITE_TIMEZONE),
        area: args.area,
        activity: args.activity,
        minutes: args.minutes ? Number(args.minutes) : undefined,
        note: args.note,
        isPublic: args.isPublic,
      },
    });
    console.log(`Logged: ${entry.date} · ${entry.area} · ${entry.activity} (id ${entry.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
