import { computeStreaks } from "./streak.ts";
import { getActiveLearnerProfileId, getLearnerProfile, isLearnerProfileId, readProfileStorage, writeProfileStorage, type LearnerProfileId } from "./learnerProfiles.ts";
import { dueReviews, nextScheduledReview, reviewCompletionId, type ScheduledReview } from "./reviewSchedule.ts";

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
  syncToken?: string;
  learnerProfile?: { id: LearnerProfileId; name: string };
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
  syncProfileImported: boolean;
};

export type SyncProgressResult = {
  addedFromServer: number;
  total: number;
  syncedAt: string;
};

export type LearnerAccountLinkResult = {
  learnerProfileId: LearnerProfileId;
  linkedAt: string;
};

const STORAGE_KEY = "learning-completions-v1";
const SYNC_TOKEN_KEY = "learning-sync-token-v1";
const BACKUP_FORMAT = "maxlie-learning-progress";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MAX_COMPLETIONS = 10_000;
const MAX_BACKUP_LENGTH = 1_000_000;

export function dateInLearningTimezone(value = new Date()): string {
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

function isSyncToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function readStore(profileId = getActiveLearnerProfileId()): LocalProgressStore {
  try {
    const parsed: unknown = JSON.parse(readProfileStorage(STORAGE_KEY, profileId) || "null");
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

function writeStore(store: LocalProgressStore, profileId = getActiveLearnerProfileId()): void {
  writeProfileStorage(STORAGE_KEY, JSON.stringify(store), profileId);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("learning-progress-changed"));
}

function getOrCreateSyncToken(profileId = getActiveLearnerProfileId()): string {
  const stored = readProfileStorage(SYNC_TOKEN_KEY, profileId);
  if (isSyncToken(stored)) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  writeProfileStorage(SYNC_TOKEN_KEY, token, profileId);
  return token;
}

export function getLocalLanguageSummary(language: string): LocalProgressSummary {
  const languageCompletions = readStore().completions.filter((item) => item.language === language);
  const streak = computeStreaks(languageCompletions.map((item) => item.date), dateInLearningTimezone());
  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalCompleted: languageCompletions.filter((item) => !item.id.startsWith("review:")).length,
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

export function getLocalCompletedLessonIds(): Set<string> {
  return new Set(readStore().completions.map((item) => item.lessonId));
}

export function getLocalDueReviews(now = new Date()): ScheduledReview[] {
  return dueReviews(readStore().completions, dateInLearningTimezone(now));
}

export function getLocalScheduledReview(lessonId: string, now = new Date()): ScheduledReview | null {
  return nextScheduledReview(readStore().completions, lessonId, dateInLearningTimezone(now));
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

export function recordLocalCompletion(input: LocalCompletionInput, now = new Date()): RecordCompletionResult {
  const store = readStore();
  const existing = store.completions.find((item) => item.id === input.id);
  let newlyCompleted = false;

  if (!existing) {
    store.completions.push({
      ...input,
      minutes: Math.max(1, Math.min(60, Math.round(input.minutes))),
      date: dateInLearningTimezone(now),
      completedAt: now.toISOString(),
    });
    writeStore(store);
    newlyCompleted = true;
  }

  return { ...getLocalCompletionSummary(input.id, input.language), newlyCompleted };
}

export function recordLocalReview(
  input: Omit<LocalCompletionInput, "id">,
  now = new Date(),
): { newlyRecorded: boolean; nextReview: ScheduledReview | null } {
  const scheduled = getLocalScheduledReview(input.lessonId, now);
  if (!scheduled?.isDue) return { newlyRecorded: false, nextReview: scheduled };

  const result = recordLocalCompletion({
    ...input,
    id: reviewCompletionId(input.lessonId, scheduled.interval),
  }, now);
  return {
    newlyRecorded: result.newlyCompleted,
    nextReview: getLocalScheduledReview(input.lessonId, now),
  };
}

export function exportLocalProgressBackup(): string {
  const profileId = getActiveLearnerProfileId();
  const profile = getLearnerProfile(profileId);
  const backup: LocalProgressBackup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    syncToken: getOrCreateSyncToken(profileId),
    learnerProfile: { id: profile.id, name: profile.name },
    ...readStore(profileId),
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

  const activeProfile = getActiveLearnerProfileId();
  if (backup.learnerProfile !== undefined && (
    !backup.learnerProfile ||
    !isLearnerProfileId(backup.learnerProfile.id) ||
    typeof backup.learnerProfile.name !== "string" ||
    backup.learnerProfile.name.length < 1 ||
    backup.learnerProfile.name.length > 100
  )) {
    throw new Error("Hồ sơ trong bản sao không hợp lệ.");
  }
  if (backup.learnerProfile && backup.learnerProfile.id !== activeProfile) {
    throw new Error(`Bản sao thuộc hồ sơ ${backup.learnerProfile.name}. Hãy chuyển đúng hồ sơ rồi nhập lại.`);
  }
  if (!backup.learnerProfile && activeProfile !== "luan") {
    throw new Error("Bản sao cũ chưa có tên hồ sơ. Hãy chuyển sang Luân rồi nhập lại để tránh trộn dữ liệu.");
  }

  const store = readStore(activeProfile);
  let syncProfileImported = false;
  if (backup.syncToken !== undefined) {
    if (!isSyncToken(backup.syncToken)) throw new Error("Khóa đồng bộ trong bản sao không hợp lệ.");
    if (readProfileStorage(SYNC_TOKEN_KEY, activeProfile) !== backup.syncToken) {
      writeProfileStorage(SYNC_TOKEN_KEY, backup.syncToken, activeProfile);
      syncProfileImported = true;
    }
  }
  const existingIds = new Set(store.completions.map((item) => item.id));
  let added = 0;
  for (const completion of backup.completions) {
    if (existingIds.has(completion.id)) continue;
    store.completions.push(completion);
    existingIds.add(completion.id);
    added += 1;
  }
  writeStore(store, activeProfile);
  return { added, skipped: backup.completions.length - added, total: store.completions.length, syncProfileImported };
}

const syncInFlight = new Map<LearnerProfileId, Promise<SyncProgressResult>>();

export function syncLocalProgress(): Promise<SyncProgressResult> {
  const profileId = getActiveLearnerProfileId();
  const existing = syncInFlight.get(profileId);
  if (existing) return existing;
  const request = (async () => {
    const before = readStore(profileId);
    const response = await fetch("/api/learning/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ token: getOrCreateSyncToken(profileId), completions: before.completions }),
    });
    if (!response.ok) throw new Error("Không thể đồng bộ lúc này.");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Phản hồi đồng bộ không hợp lệ.");
    const remote = (payload as { completions?: unknown }).completions;
    const linkedProfile = (payload as { learnerProfileId?: unknown }).learnerProfileId;
    if (linkedProfile !== null && linkedProfile !== undefined && linkedProfile !== profileId) {
      if (!isLearnerProfileId(linkedProfile)) throw new Error("Hồ sơ tài khoản không hợp lệ.");
      throw new Error(`Tài khoản này thuộc hồ sơ ${getLearnerProfile(linkedProfile).name}. Hãy chuyển đúng hồ sơ để đồng bộ.`);
    }
    if (!Array.isArray(remote) || remote.length > MAX_COMPLETIONS || !remote.every(isCompletion)) {
      throw new Error("Dữ liệu đồng bộ không hợp lệ.");
    }

    const latest = readStore(profileId);
    const ids = new Set(latest.completions.map((item) => item.id));
    let addedFromServer = 0;
    for (const completion of remote) {
      if (ids.has(completion.id)) continue;
      latest.completions.push(completion);
      ids.add(completion.id);
      addedFromServer += 1;
    }
    if (addedFromServer > 0) writeStore(latest, profileId);
    return { addedFromServer, total: latest.completions.length, syncedAt: new Date().toISOString() };
  })().finally(() => {
    syncInFlight.delete(profileId);
  });
  syncInFlight.set(profileId, request);
  return request;
}

export async function getLearnerAccountLink(): Promise<LearnerAccountLinkResult | null> {
  const response = await fetch("/api/learning/account", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể đọc liên kết tài khoản.");
  const payload: unknown = await response.json();
  const link = (payload as { link?: unknown }).link;
  if (link === null) return null;
  if (!link || typeof link !== "object") throw new Error("Liên kết tài khoản không hợp lệ.");
  const candidate = link as Partial<LearnerAccountLinkResult>;
  if (!isLearnerProfileId(candidate.learnerProfileId) || typeof candidate.linkedAt !== "string") {
    throw new Error("Liên kết tài khoản không hợp lệ.");
  }
  return { learnerProfileId: candidate.learnerProfileId, linkedAt: candidate.linkedAt };
}

export async function linkActiveProfileToAccount(): Promise<LearnerAccountLinkResult> {
  const learnerProfileId = getActiveLearnerProfileId();
  const response = await fetch("/api/learning/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ learnerProfileId, token: getOrCreateSyncToken(learnerProfileId) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "Không thể liên kết lúc này.";
    throw new Error(message);
  }
  const link = (payload as { link?: unknown }).link;
  if (!link || typeof link !== "object") throw new Error("Liên kết tài khoản không hợp lệ.");
  const candidate = link as Partial<LearnerAccountLinkResult>;
  if (!isLearnerProfileId(candidate.learnerProfileId) || typeof candidate.linkedAt !== "string") {
    throw new Error("Liên kết tài khoản không hợp lệ.");
  }
  void syncLocalProgress().catch(() => undefined);
  return { learnerProfileId: candidate.learnerProfileId, linkedAt: candidate.linkedAt };
}
