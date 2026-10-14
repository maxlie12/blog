import type { SkillId } from "@/lib/lessonTypes";
export const ENGLISH_LEVELS = ["A1", "A2", "B1", "B1+", "B2", "B2+", "C1", "C2", "Other"];
export const CHINESE_LEVELS = ["Beginner", "Elementary", "Other"];
export function lessonLevel(level: string, language: string): string {
  if (language === "zh") return /beginner/i.test(level) ? "Beginner" : /elementary/i.test(level) ? "Elementary" : "Other";
  return level.toUpperCase().match(/\b(?:A[12]|B[12]|C[12])\+?/)?.[0] ?? "Other";
}
export function levelRank(level: string, language: string): number {
  const index = (language === "zh" ? CHINESE_LEVELS : ENGLISH_LEVELS).indexOf(lessonLevel(level, language));
  return index < 0 ? 99 : index;
}
const skillRank: Record<SkillId, number> = { listening: 0, reading: 1, speaking: 2, writing: 3 };
export function lessonRank(skill: SkillId): number { return skillRank[skill]; }
