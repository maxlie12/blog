import { prisma } from "@/lib/db";

export type SkillId = "writing" | "listening" | "speaking" | "reading";

export const SKILLS: { id: SkillId; label: string; description: string }[] = [
  { id: "writing", label: "Writing", description: "Short, structured writing practice." },
  { id: "listening", label: "Listening", description: "Listen and check comprehension." },
  { id: "speaking", label: "Speaking", description: "Record and review short spoken answers." },
  { id: "reading", label: "Reading", description: "Read and summarize short texts." },
];

export interface LessonSummary {
  id: string;
  skill: SkillId;
  title: string;
  level: string;
  instructions: string;
  material: string | null;
  exercises: string | null;
  completionCriteria: string;
  attemptCount: number;
  reviewedCount: number;
}

export interface AttemptRecord {
  id: string;
  lessonId: string;
  date: string;
  response: string | null;
  feedback: string | null;
  reviewStatus: string;
  createdAt: string;
}

/** Public read: all lessons with attempt counts, for the skill cards + lesson picker. */
export async function getAllLessons(): Promise<LessonSummary[]> {
  const lessons = await prisma.lesson.findMany({
    include: { attempts: { select: { reviewStatus: true } } },
    orderBy: { createdAt: "asc" },
  });
  return lessons.map((l) => ({
    id: l.id,
    skill: l.skill as SkillId,
    title: l.title,
    level: l.level,
    instructions: l.instructions,
    material: l.material,
    exercises: l.exercises,
    completionCriteria: l.completionCriteria,
    attemptCount: l.attempts.length,
    reviewedCount: l.attempts.filter((a) => a.reviewStatus === "reviewed").length,
  }));
}

export async function getLessonWithAttempts(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { attempts: { orderBy: { date: "desc" } } },
  });
  if (!lesson) return null;
  return {
    ...lesson,
    skill: lesson.skill as SkillId,
    attempts: lesson.attempts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/** A lesson counts toward a skill's completed progress once it has at least one *reviewed*
 * attempt — a pending or needs-revision attempt means the work isn't done yet. Never derived
 * from a raw attempt/lesson count alone. See docs/DECISIONS.md. */
export async function getSkillProgress(): Promise<Record<SkillId, { completed: number; total: number }>> {
  const lessons = await getAllLessons();
  const progress = {} as Record<SkillId, { completed: number; total: number }>;
  for (const skill of SKILLS) {
    const skillLessons = lessons.filter((l) => l.skill === skill.id);
    progress[skill.id] = {
      total: skillLessons.length,
      completed: skillLessons.filter((l) => l.reviewedCount > 0).length,
    };
  }
  return progress;
}

export async function getRecentAttempts(limit = 10) {
  const attempts = await prisma.attempt.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lesson: { select: { title: true, skill: true } } },
  });
  return attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
}

export function isValidSkill(value: string): value is SkillId {
  return SKILLS.some((s) => s.id === value);
}
