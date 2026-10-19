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

export type LocalCompletionSummary = {
  completed: boolean;
  completedOn: string | null;
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
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

function addDays(dateString: string, amount: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
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

function streaks(completions: LocalCompletion[]): { current: number; longest: number } {
  const dates = Array.from(new Set(completions.map((item) => item.date))).sort();
  if (!dates.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    run = addDays(dates[index - 1], 1) === dates[index] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = dates[dates.length - 1];
  const today = dateInLearningTimezone();
  let current = 0;
  if (last === today || last === addDays(today, -1)) {
    current = 1;
    for (let index = dates.length - 1; index > 0; index -= 1) {
      if (addDays(dates[index - 1], 1) !== dates[index]) break;
      current += 1;
    }
  }
  return { current, longest };
}

export function getLocalCompletionSummary(id: string, language: string): LocalCompletionSummary {
  const completions = readStore().completions;
  const languageCompletions = completions.filter((item) => item.language === language);
  const match = completions.find((item) => item.id === id);
  const streak = streaks(languageCompletions);
  return {
    completed: Boolean(match),
    completedOn: match?.date ?? null,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalCompleted: languageCompletions.length,
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
