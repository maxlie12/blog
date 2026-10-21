import type { Metadata } from "next";
import { LearningWorld, type WorldQuest } from "@/components/LearningWorld";
import { getAllLessons } from "@/lib/lessonsData";
import type { SkillId } from "@/lib/lessonTypes";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";

export const metadata: Metadata = { title: "Learning Farm" };
export const dynamic = "force-dynamic";

const SKILL_ORDER: SkillId[] = ["listening", "reading", "speaking", "writing"];

function toQuest(lesson: Awaited<ReturnType<typeof getAllLessons>>[number]): WorldQuest {
  const date = lesson.id.match(/daily-(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return {
    id: lesson.id,
    skill: lesson.skill,
    language: lesson.language === "zh" ? "zh" : "en",
    title: lesson.title,
    level: lesson.level,
    instructions: lesson.instructions,
    completionCriteria: lesson.completionCriteria,
    date,
    attemptCount: lesson.attemptCount,
    reviewedCount: lesson.reviewedCount,
  };
}

export default async function LearningWorldPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const lessons = await getAllLessons({ learnerId });
  const daily = lessons
    .filter((lesson) => lesson.id.startsWith("daily-"))
    .sort((a, b) => a.id.localeCompare(b.id));

  const english = SKILL_ORDER.flatMap((skill) => {
    const options = daily.filter((lesson) => lesson.language === "en" && lesson.skill === skill);
    const next = options.find((lesson) => lesson.reviewedCount === 0) ?? options.at(-1);
    return next ? [toQuest(next)] : [];
  });
  const chineseOptions = daily.filter((lesson) => lesson.language === "zh");
  const chineseLesson = chineseOptions.find((lesson) => lesson.reviewedCount === 0) ?? chineseOptions.at(-1);

  return <LearningWorld englishQuests={english} chineseQuest={chineseLesson ? toQuest(chineseLesson) : null} />;
}
