export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文 · Tiếng Trung" },
] as const;
export type LanguageId = (typeof LANGUAGES)[number]["id"];
export function isValidLanguage(value: string): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}
