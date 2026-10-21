import type { SkillId } from "./lessonTypes.ts";
import { languageRank } from "./languages.ts";
const skillOrder: Record<SkillId, number> = { listening: 0, reading: 1, speaking: 2, writing: 3 };
export function orderPractice<T extends { language: string; skill: SkillId; id: string }>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => {
    const language = languageRank(a.language) - languageRank(b.language);
    return language || skillOrder[a.skill] - skillOrder[b.skill] || Number(a.id.endsWith("-application")) - Number(b.id.endsWith("-application"));
  });
}
