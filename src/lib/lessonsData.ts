import { prisma } from "@/lib/db";
import { getDailyPackets, getDailyLesson } from "@/lib/dailyLessons";

import { SKILLS, type SkillId, type LessonSummary } from "@/lib/lessonTypes";
export { SKILLS, type SkillId, type LessonSummary, type AttemptRecord } from "@/lib/lessonTypes";

/** Public read: all lessons with attempt counts, for the skill cards + lesson picker. */
export async function getAllLessons(): Promise<LessonSummary[]> {
  const [lessons, counts] = await Promise.all([
    prisma.lesson.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attempt.groupBy({ by: ["lessonId", "reviewStatus"], _count: { _all: true } }),
  ]);
  const byLesson = new Map<string, { total: number; reviewed: number }>();
  for (const count of counts) {
    const entry = byLesson.get(count.lessonId) ?? { total: 0, reviewed: 0 };
    entry.total += count._count._all;
    if (count.reviewStatus === "reviewed") entry.reviewed += count._count._all;
    byLesson.set(count.lessonId, entry);
  }
  const storedIds = new Set(lessons.map((l) => l.id));
  const daily = (await getDailyPackets()).flatMap((p) => p.lessons).filter((l) => !storedIds.has(l.id));
  return [...lessons, ...daily].map((l) => ({
    id: l.id,
    skill: l.skill as SkillId,
    language: l.language,
    title: l.title,
    level: l.level,
    instructions: l.instructions,
    material: l.material,
    exercises: l.exercises,
    completionCriteria: l.completionCriteria,
    attemptCount: byLesson.get(l.id)?.total ?? 0,
    reviewedCount: byLesson.get(l.id)?.reviewed ?? 0,
  }));
}

export async function getLessonWithAttempts(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { attempts: { orderBy: { date: "desc" } } },
  });
  if (!lesson) {
    const daily = await getDailyLesson(id);
    return daily ? { ...daily, attempts: [] } : null;
  }
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
export async function getSkillProgress(language = "en"): Promise<Record<SkillId, { completed: number; total: number }>> {
  const lessons = await getAllLessons();
  const progress = {} as Record<SkillId, { completed: number; total: number }>;
  for (const skill of SKILLS) {
    const skillLessons = lessons.filter((l) => l.skill === skill.id && l.language === language);
    progress[skill.id] = {
      total: skillLessons.length,
      completed: skillLessons.filter((l) => l.reviewedCount > 0).length,
    };
  }
  return progress;
}

export async function getAttemptWithLesson(attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { lesson: true },
  });
  if (!attempt) return null;
  return {
    ...attempt,
    createdAt: attempt.createdAt.toISOString(),
    lesson: { ...attempt.lesson, skill: attempt.lesson.skill as SkillId },
  };
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
