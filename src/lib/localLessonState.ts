import { readProfileStorage } from "./learnerProfiles.ts";

export function hasLessonDraft(lessonId: string): boolean {
  try {
    const raw = readProfileStorage("learning-practice-v1:" + lessonId);
    if (!raw) return false;
    const value = JSON.parse(raw) as { version?: unknown; lessonId?: unknown; response?: unknown };
    return value?.version === 1 && value.lessonId === lessonId && typeof value.response === "string" && Boolean(value.response.trim());
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
