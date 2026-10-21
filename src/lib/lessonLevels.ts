import type { SkillId } from "./lessonTypes.ts";
import { getLanguageLevels } from "./languages.ts";

export function lessonLevel(level: string, language: string): string {
  if (language === "zh") return /beginner/i.test(level) ? "Beginner" : /elementary/i.test(level) ? "Elementary" : "Other";
  if (language === "ja") {
    if (/starter/i.test(level)) return "Starter";
    if (/\bN5\b/i.test(level)) return "N5";
    if (/\bA1\b/i.test(level)) return "A1";
    return "Other";
  }
  const label = level.toUpperCase();
  return label.match(/\b((?:A[12]|B[12]|C[12])\+?)\s+PRACTICE/)?.[1] ?? label.match(/\b(?:A[12]|B[12]|C[12])\+?/)?.[0] ?? "Other";
}
export function levelRank(level: string, language: string): number {
  const index = getLanguageLevels(language).indexOf(lessonLevel(level, language));
  return index < 0 ? 99 : index;
}
const skillRank: Record<SkillId, number> = { listening: 0, reading: 1, speaking: 2, writing: 3 };
export function lessonRank(skill: SkillId): number { return skillRank[skill]; }
