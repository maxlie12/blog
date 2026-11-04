import { readProfileStorage, writeProfileStorage } from "./learnerProfiles.ts";

type SessionIdentity = { language: "en" | "zh"; startedAt: string };

export function readSavedSessions<T extends SessionIdentity>(
  language: T["language"],
  isValid: (value: unknown) => value is T,
): T[] {
  const key = "guided-practice-history-v1:" + language;
  const raw = readProfileStorage(key);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed) || !parsed.every(value => isValid(value) && value.language === language)) {
    throw new Error("Không đọc được lịch sử; giữ nguyên dữ liệu để tránh mất bài.");
  }
  const sessions: T[] = parsed;
  const legacy = readProfileStorage("guided-practice-v1:" + language);
  if (legacy) {
    const latest: unknown = JSON.parse(legacy);
    if (!isValid(latest) || latest.language !== language) throw new Error("Bản nháp cũ không hợp lệ; chưa ghi đè.");
    if (!sessions.some(session => session.startedAt === latest.startedAt)) {
      sessions.push(latest);
      writeProfileStorage(key, JSON.stringify(sessions));
    }
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function saveSession<T extends SessionIdentity>(
  next: T,
  isValid: (value: unknown) => value is T,
): T[] {
  if (!isValid(next)) throw new Error("Phiên học chưa hợp lệ.");
  const sessions = readSavedSessions(next.language, isValid);
  const index = sessions.findIndex(session => session.startedAt === next.startedAt);
  if (index < 0) sessions.unshift(next);
  else sessions[index] = next;
  // Write history first: a failed write must never replace the only legacy draft.
  writeProfileStorage("guided-practice-history-v1:" + next.language, JSON.stringify(sessions));
  writeProfileStorage("guided-practice-v1:" + next.language, JSON.stringify(next));
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
