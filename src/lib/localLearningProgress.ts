import { computeStreaks } from "@/lib/streak";

export type LocalCompletionInput = {
  id: string;
  lessonId: string;
  language: string;
  skill: string;
  minutes: number;
};

type LocalCompletion = LocalCompletionInput & {
  date: string;
  completedAt: string;
};

type LocalProgressStore = {
  version: 1;
  completions: LocalCompletion[];
};

export type LocalProgressSummary = {
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
};

export type LocalCompletionSummary = LocalProgressSummary & {
  completed: boolean;
  completedOn: string | null;
};

export type RecordCompletionResult = LocalCompletionSummary & {
  newlyCompleted: boolean;
};

const STORAGE_KEY = "learning-completions-v1";
const TIME_ZONE = "Asia/Ho_Chi_Minh";

function dateInLearningTimezone(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function isCompletion(value: unknown): value is LocalCompletion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LocalCompletion>;
  return typeof item.id === "string" && !!item.id &&
    typeof item.lessonId === "string" &&
    typeof item.language === "string" &&
    typeof item.skill === "string" &&
    typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.completedAt === "string" && !Number.isNaN(Date.parse(item.completedAt)) &&
    typeof item.minutes === "number" && Number.isFinite(item.minutes) &&
    item.minutes >= 1 && item.minutes <= 60;
}

function readStore(): LocalProgressStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return { version: 1, completions: [] };
    const candidate = parsed as Partial<LocalProgressStore>;
    if (candidate.version !== 1 || !Array.isArray(candidate.completions)) {
      return { version: 1, completions: [] };
    }
    return { version: 1, completions: candidate.completions.filter(isCompletion) };
  } catch {
    return { version: 1, completions: [] };
  }
}

export function getLocalLanguageSummary(language: string): LocalProgressSummary {
  const languageCompletions = readStore().completions.filter((item) => item.language === language);
  const streak = computeStreaks(languageCompletions.map((item) => item.date), dateInLearningTimezone());
  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalCompleted: languageCompletions.length,
  };
}

export function getLocalCompletionSummary(id: string, language: string): LocalCompletionSummary {
  const completions = readStore().completions;
  const match = completions.find((item) => item.id === id);
  return {
    ...getLocalLanguageSummary(language),
    completed: Boolean(match),
    completedOn: match?.date ?? null,
  };
}

export function recordLocalCompletion(input: LocalCompletionInput): RecordCompletionResult {
  const store = readStore();
  const existing = store.completions.find((item) => item.id === input.id);
  let newlyCompleted = false;

  if (!existing) {
    store.completions.push({
      ...input,
      minutes: Math.max(1, Math.min(60, Math.round(input.minutes))),
      date: dateInLearningTimezone(),
      completedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    newlyCompleted = true;
  }

  return { ...getLocalCompletionSummary(input.id, input.language), newlyCompleted };
}
