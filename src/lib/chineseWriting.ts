export function normalizeChineseAnswer(value: string): string {
  return value.normalize("NFKC").replace(/[\s，。！？、,.!?]/g, "").toLowerCase();
}

export function getHandwritingCharacters(value: string): string[] {
  return [...new Set(Array.from(value).filter((character) => /\p{Script=Han}/u.test(character)))];
}

export function scheduleChineseRetry<T>(remaining: T[], missed: T, gap = 2): T[] {
  const insertionIndex = Math.min(Math.max(gap, 0), remaining.length);
  return [
    ...remaining.slice(0, insertionIndex),
    missed,
    ...remaining.slice(insertionIndex),
  ];
}
