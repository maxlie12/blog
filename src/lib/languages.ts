export const LANGUAGES = [
  {
    id: "en",
    label: "English",
    shortLabel: "English",
    levels: ["A1", "A2", "B1", "B1+", "B2", "B2+", "C1", "C2", "Other"],
    checkpoint: "Bốn kỹ năng, nội dung chưa luyện",
  },
  {
    id: "zh",
    label: "中文 · Tiếng Trung",
    shortLabel: "中文",
    levels: ["Beginner", "Elementary", "Other"],
    checkpoint: "Hội thoại ngắn trong tình huống mới",
  },
  {
    id: "ja",
    label: "日本語 · Tiếng Nhật",
    shortLabel: "日本語",
    levels: ["Starter", "A1", "N5", "Other"],
    checkpoint: "Tự giới thiệu và phản hồi ngắn không nhìn mẫu",
  },
] as const;
export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const LANGUAGE_IDS = LANGUAGES.map((language) => language.id) as [LanguageId, ...LanguageId[]];

export function isValidLanguage(value: string): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}

export function getLanguage(value: string) {
  return LANGUAGES.find((language) => language.id === value);
}

export function getLanguageLabel(value: string, short = false): string {
  const language = getLanguage(value);
  return language ? (short ? language.shortLabel : language.label) : value;
}

export function getLanguageLevels(value: string): readonly string[] {
  return getLanguage(value)?.levels ?? ["Other"];
}

export function languageRank(value: string): number {
  const index = LANGUAGES.findIndex((language) => language.id === value);
  return index < 0 ? LANGUAGES.length : index;
}
