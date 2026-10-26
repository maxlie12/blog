export function normalizeChineseAnswer(value: string): string {
  return value.normalize("NFKC").replace(/[\s，。！？、,.!?]/g, "").toLowerCase();
}

export function getHandwritingCharacters(value: string): string[] {
  return [...new Set(Array.from(value).filter((character) => /\p{Script=Han}/u.test(character)))];
}
