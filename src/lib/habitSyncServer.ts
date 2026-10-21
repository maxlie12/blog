import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import { isLearnerProfileId, type LearnerProfileId } from "./learnerProfiles.ts";

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
      await client.query(`
        CREATE TABLE IF NOT EXISTS learner_profile_owner (
          provider_user_id VARCHAR(200) PRIMARY KEY,
          profile_id CHAR(64) NOT NULL UNIQUE,
          learner_profile_id VARCHAR(16) NOT NULL,
          linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

type OwnerRow = {
  provider_user_id: string;
  profile_id: string;
  learner_profile_id: string;
  linked_at: string | Date;
};

export class HabitProfileConflictError extends Error {}
export class HabitProfileAccessError extends Error {}

export function canAccessClaimedProfile(ownerUserId: string | null, viewerUserId: string | null): boolean {
  return ownerUserId === null || ownerUserId === viewerUserId;
}

function toAccountLink(row: OwnerRow) {
  if (!isLearnerProfileId(row.learner_profile_id)) return null;
  return {
    learnerProfileId: row.learner_profile_id,
    linkedAt: row.linked_at instanceof Date ? row.linked_at.toISOString() : new Date(row.linked_at).toISOString(),
  };
}

export async function getHabitAccountLink(providerUserId: string) {
  await ensureSchema();
  const rows = await getSql().query(`
    SELECT provider_user_id, profile_id, learner_profile_id, linked_at
    FROM learner_profile_owner
    WHERE provider_user_id = $1
    LIMIT 1
  `, [providerUserId]) as OwnerRow[];
  return rows[0] ? toAccountLink(rows[0]) : null;
}

export async function claimHabitProfile(
  providerUserId: string,
  token: string,
  learnerProfileId: LearnerProfileId
) {
  await ensureSchema();
  const client = getSql();
  const hashedProfile = profileId(token);
  const existing = await client.query(`
    SELECT provider_user_id, profile_id, learner_profile_id, linked_at
    FROM learner_profile_owner
    WHERE provider_user_id = $1 OR profile_id = $2
  `, [providerUserId, hashedProfile]) as OwnerRow[];
  const accountOwner = existing.find((row) => row.provider_user_id === providerUserId);
  if (accountOwner) {
    if (accountOwner.profile_id !== hashedProfile || accountOwner.learner_profile_id !== learnerProfileId) {
      throw new HabitProfileConflictError("Tài khoản đã liên kết với một hồ sơ khác.");
    }
    return toAccountLink(accountOwner);
  }
  if (existing.some((row) => row.profile_id === hashedProfile)) {
    throw new HabitProfileConflictError("Hồ sơ này đã thuộc một tài khoản khác.");
  }

  try {
    const rows = await client.query(`
      INSERT INTO learner_profile_owner (provider_user_id, profile_id, learner_profile_id)
      VALUES ($1, $2, $3)
      RETURNING provider_user_id, profile_id, learner_profile_id, linked_at
    `, [providerUserId, hashedProfile, learnerProfileId]) as OwnerRow[];
    return toAccountLink(rows[0]);
  } catch {
    // A concurrent claim can win after the checks above; never merge two identities.
    throw new HabitProfileConflictError("Không thể liên kết vì hồ sơ hoặc tài khoản vừa được sử dụng.");
  }
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

export async function mergeHabitCompletions(
  token: string,
  completions: HabitCompletion[],
  providerUserId: string | null = null
): Promise<{ completions: HabitCompletion[]; learnerProfileId: LearnerProfileId | null }> {
  await ensureSchema();
  const client = getSql();
  const tokenProfile = profileId(token);
  let hashedProfile = tokenProfile;
  let learnerProfileId: LearnerProfileId | null = null;

  if (providerUserId) {
    const accountLink = await getHabitAccountLink(providerUserId);
    if (accountLink) {
      const rows = await client.query(`SELECT profile_id FROM learner_profile_owner WHERE provider_user_id = $1 LIMIT 1`, [providerUserId]) as { profile_id: string }[];
      hashedProfile = rows[0].profile_id;
      learnerProfileId = accountLink.learnerProfileId;
    }
  }

  if (hashedProfile === tokenProfile) {
    const owners = await client.query(`
      SELECT provider_user_id, learner_profile_id FROM learner_profile_owner WHERE profile_id = $1 LIMIT 1
    `, [hashedProfile]) as Pick<OwnerRow, "provider_user_id" | "learner_profile_id">[];
    if (!canAccessClaimedProfile(owners[0]?.provider_user_id ?? null, providerUserId)) {
      throw new HabitProfileAccessError("Hồ sơ đã được bảo vệ bởi tài khoản khác.");
    }
    if (owners[0] && isLearnerProfileId(owners[0].learner_profile_id)) {
      learnerProfileId = owners[0].learner_profile_id;
    }
  }

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

  return { completions: rows.map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    language: row.language,
    skill: row.skill,
    minutes: Number(row.minutes),
    date: row.date,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : new Date(row.completed_at).toISOString(),
  })), learnerProfileId };
}
