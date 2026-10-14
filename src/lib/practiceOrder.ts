import type { SkillId } from "@/lib/lessonTypes";
const skillOrder: Record<SkillId, number> = { listening: 0, reading: 1, speaking: 2, writing: 3 };
export function orderPractice<T extends { language: string; skill: SkillId; id: string }>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => {
    const language = (a.language === "zh" ? 1 : 0) - (b.language === "zh" ? 1 : 0);
    return language || skillOrder[a.skill] - skillOrder[b.skill] || Number(a.id.endsWith("-application")) - Number(b.id.endsWith("-application"));
  });
}
