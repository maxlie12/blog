import { isLearningMethodId, type LearningMethodId } from "./learningMethods.ts";
import { readProfileStorage } from "./learnerProfiles.ts";

export type LessonDraft = {
  version: 1; lessonId: string; response: string; minutes: number; support: string;
  focus: string; gap: "meaning" | "reasoning" | "language" | "delivery";
  revision: string; sourceResult?: string; method?: LearningMethodId; savedAt: string;
};

export function parseLessonDraft(raw: string, lessonId: string): LessonDraft {
  const value = JSON.parse(raw) as Partial<LessonDraft> | null;
  if (!value || value.version !== 1 || value.lessonId !== lessonId ||
    typeof value.response !== "string" || !value.response.trim() ||
    typeof value.minutes !== "number" || !Number.isInteger(value.minutes) || value.minutes < 1 || value.minutes > 60 ||
    typeof value.support !== "string" || typeof value.focus !== "string" ||
    typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt)) ||
    (value.method !== undefined && !isLearningMethodId(value.method)) ||
    !["meaning", "reasoning", "language", "delivery"].includes(value.gap ?? "") ||
    (value.revision !== undefined && typeof value.revision !== "string") ||
    (value.sourceResult !== undefined && typeof value.sourceResult !== "string")) {
    throw new Error("Bản nháp không hợp lệ.");
  }
  return { ...value, revision: value.revision ?? "" } as LessonDraft;
}

export function hasLessonDraft(lessonId: string): boolean {
  try {
    const raw = readProfileStorage("learning-practice-v1:" + lessonId);
    return raw ? Boolean(parseLessonDraft(raw, lessonId)) : false;
  } catch { return false; }
}

export function localLessonStatus(id: string, completed: ReadonlySet<string>, drafts: ReadonlySet<string>) {
  return completed.has(id) ? "done" : drafts.has(id) ? "draft" : "new";
}

export function chooseDailyDate(
  packets: readonly { date: string; lessons: readonly { id: string; language: string }[] }[],
  completed: ReadonlySet<string>,
  drafts: ReadonlySet<string>,
): string {
  const newest = [...packets].sort((a, b) => b.date.localeCompare(a.date));
  return (newest.find(p => p.lessons.some(l => drafts.has(l.id) && !completed.has(l.id))) ??
    newest.find(p => p.lessons.some(l => l.language === "en" && !completed.has(l.id))) ?? newest[0])?.date ?? "";
}

export function dailyLessonDate(id: string): string | null {
  return /^daily-(\d{4}-\d{2}-\d{2})-/.exec(id)?.[1] ?? null;
}
