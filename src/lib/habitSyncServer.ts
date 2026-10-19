import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

const completionSchema = z.object({
  id: z.string().min(1).max(200),
  lessonId: z.string().min(1).max(200),
  language: z.string().min(1).max(16),
  skill: z.string().min(1).max(40),
  minutes: z.number().int().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedAt: z.iso.datetime(),
});

export const syncRequestSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  completions: z.array(completionSchema).max(2_000),
});

export type HabitCompletion = z.infer<typeof completionSchema>;

let sql: NeonQueryFunction<false, false> | null = null;
let schemaPromise: Promise<void> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error("NEON_DATABASE_URL is not configured");
  if (!sql) sql = neon(connectionString);
  return sql;
}

function profileId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    const client = getSql();
    // PONYTAIL SHORTCUT: one isolated personal-progress table is bootstrapped lazily.
    // If its shape changes, replace this with a numbered migration before deployment.
    schemaPromise = (async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS habit_completion (
          profile_id CHAR(64) NOT NULL,
          client_id VARCHAR(200) NOT NULL,
          lesson_id VARCHAR(200) NOT NULL,
          language VARCHAR(16) NOT NULL,
          skill VARCHAR(40) NOT NULL,
          minutes SMALLINT NOT NULL CHECK (minutes BETWEEN 1 AND 60),
          completed_date DATE NOT NULL,
          completed_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (profile_id, client_id)
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS habit_completion_profile_date_idx
        ON habit_completion (profile_id, completed_date)
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

type CompletionRow = {
  id: string;
  lesson_id: string;
  language: string;
  skill: string;
  minutes: number;
  date: string;
  completed_at: string | Date;
};

export async function mergeHabitCompletions(token: string, completions: HabitCompletion[]): Promise<HabitCompletion[]> {
  await ensureSchema();
  const client = getSql();
  const hashedProfile = profileId(token);

  if (completions.length > 0) {
    await client.query(`
      INSERT INTO habit_completion (
        profile_id, client_id, lesson_id, language, skill, minutes, completed_date, completed_at
      )
      SELECT $1, item.id, item."lessonId", item.language, item.skill, item.minutes,
        item.date::date, item."completedAt"::timestamptz
      FROM jsonb_to_recordset($2::jsonb) AS item(
        id text, "lessonId" text, language text, skill text, minutes smallint,
        date text, "completedAt" text
      )
      WHERE (SELECT COUNT(*) FROM habit_completion WHERE profile_id = $1) < 10000
        AND (SELECT COUNT(*) FROM habit_completion) < 50000
      ON CONFLICT (profile_id, client_id) DO NOTHING
    `, [hashedProfile, JSON.stringify(completions)]);
  }

  const rows = await client.query(`
    SELECT client_id AS id, lesson_id, language, skill, minutes,
      completed_date::text AS date, completed_at
    FROM habit_completion
    WHERE profile_id = $1
    ORDER BY completed_at ASC
    LIMIT 10000
  `, [hashedProfile]) as CompletionRow[];

  return rows.map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    language: row.language,
    skill: row.skill,
    minutes: Number(row.minutes),
    date: row.date,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : new Date(row.completed_at).toISOString(),
  }));
}
