import { computeStreaks } from "./streak.ts";

export type LocalCompletionInput = {
  id: string;
  lessonId: string;
  language: string;
  skill: string;
  minutes: number;
};

export type LocalCompletion = LocalCompletionInput & {
  date: string;
  completedAt: string;
};

type LocalProgressStore = {
  version: 1;
  completions: LocalCompletion[];
};

type LocalProgressBackup = LocalProgressStore & {
  format: "maxlie-learning-progress";
  exportedAt: string;
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

export type LocalActivityDay = {
  date: string;
  count: number;
};

export type ImportProgressResult = {
  added: number;
  skipped: number;
  total: number;
};

const STORAGE_KEY = "learning-completions-v1";
const BACKUP_FORMAT = "maxlie-learning-progress";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MAX_COMPLETIONS = 10_000;
const MAX_BACKUP_LENGTH = 1_000_000;

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

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function isShortString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isCompletion(value: unknown): value is LocalCompletion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LocalCompletion>;
  return isShortString(item.id, 200) &&
    isShortString(item.lessonId, 200) &&
    isShortString(item.language, 16) &&
    isShortString(item.skill, 40) &&
    typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.completedAt === "string" && !Number.isNaN(Date.parse(item.completedAt)) &&
    typeof item.minutes === "number" && Number.isInteger(item.minutes) &&
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

function writeStore(store: LocalProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

export function getLocalLanguageActivity(language: string, days = 28, now = new Date()): LocalActivityDay[] {
  const safeDays = Math.max(1, Math.min(366, Math.round(days)));
  const lastDay = dateInLearningTimezone(now);
  const counts = new Map<string, number>();
  for (const item of readStore().completions) {
    if (item.language === language) counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  }
  return Array.from({ length: safeDays }, (_, index) => {
    const date = addDays(lastDay, index - safeDays + 1);
    return { date, count: counts.get(date) ?? 0 };
  });
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
    writeStore(store);
    newlyCompleted = true;
  }

  return { ...getLocalCompletionSummary(input.id, input.language), newlyCompleted };
}

export function exportLocalProgressBackup(): string {
  const backup: LocalProgressBackup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    ...readStore(),
  };
  return JSON.stringify(backup, null, 2);
}

export function importLocalProgressBackup(raw: string): ImportProgressResult {
  if (raw.length > MAX_BACKUP_LENGTH) throw new Error("File sao lưu lớn hơn giới hạn 1 MB.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("File sao lưu không đúng định dạng.");
  const backup = parsed as Partial<LocalProgressBackup>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== 1 || !Array.isArray(backup.completions)) {
    throw new Error("File không phải bản sao tiến độ Maxlie Learning.");
  }
  if (backup.completions.length > MAX_COMPLETIONS || !backup.completions.every(isCompletion)) {
    throw new Error("Bản sao có dữ liệu không hợp lệ hoặc quá nhiều bản ghi.");
  }

  const store = readStore();
  const existingIds = new Set(store.completions.map((item) => item.id));
  let added = 0;
  for (const completion of backup.completions) {
    if (existingIds.has(completion.id)) continue;
    store.completions.push(completion);
    existingIds.add(completion.id);
    added += 1;
  }
  writeStore(store);
  return { added, skipped: backup.completions.length - added, total: store.completions.length };
}
