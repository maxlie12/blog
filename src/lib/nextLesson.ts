import type { LearnerProfileId } from "./learnerProfiles.ts";
import { lessonLevel } from "./lessonLevels.ts";
import type { LessonSummary } from "./lessonTypes.ts";
import type { ScheduledReview } from "./reviewSchedule.ts";

export type NextLessonReason = "resume" | "due-review" | "next" | "review";

export type NextLesson = {
  lesson: LessonSummary;
  reason: NextLessonReason;
  review?: ScheduledReview;
};

const PROFILE_PATHS: Record<LearnerProfileId, { languages: string[]; levels: Record<string, string[]> }> = {
  luan: {
    languages: ["en", "zh", "ja"],
    levels: {
      en: ["B1+", "B1", "B2", "A2", "B2+", "C1", "C2", "Other"],
      zh: ["Beginner", "Elementary", "Other"],
      ja: ["Starter", "A1", "N5", "Other"],
    },
  },
  phi: {
    languages: ["ja", "en", "zh"],
    levels: {
      ja: ["Starter", "A1", "N5", "Other"],
      en: ["A1", "A2", "B1", "B1+", "B2", "B2+", "C1", "C2", "Other"],
      zh: ["Beginner", "Elementary", "Other"],
    },
  },
};

function rank(value: string, values: string[]): number {
  const index = values.indexOf(value);
  return index < 0 ? values.length : index;
}

function orderedLessons(lessons: LessonSummary[], profileId: LearnerProfileId): LessonSummary[] {
  const path = PROFILE_PATHS[profileId];
  return [...lessons].sort((a, b) => {
    const languageDifference = rank(a.language, path.languages) - rank(b.language, path.languages);
    if (languageDifference) return languageDifference;
    const levels = path.levels[a.language] ?? ["Other"];
    const levelDifference = rank(lessonLevel(a.level, a.language), levels) - rank(lessonLevel(b.level, b.language), levels);
    return levelDifference || a.id.localeCompare(b.id);
  });
}

export function selectNextLesson(
  lessons: LessonSummary[],
  profileId: LearnerProfileId,
  completedLessonIds: ReadonlySet<string>,
  draftLessonIds: ReadonlySet<string>,
  dueReviewItems: readonly ScheduledReview[] = [],
): NextLesson | null {
  const ordered = orderedLessons(lessons, profileId);
  const resume = ordered.find((lesson) => draftLessonIds.has(lesson.id) && !completedLessonIds.has(lesson.id));
  if (resume) return { lesson: resume, reason: "resume" };

  for (const review of dueReviewItems) {
    const lesson = ordered.find((item) => item.id === review.lessonId);
    if (lesson) return { lesson, reason: "due-review", review };
  }

  const next = ordered.find((lesson) => !completedLessonIds.has(lesson.id));
  if (next) return { lesson: next, reason: "next" };

  return ordered[0] ? { lesson: ordered[0], reason: "review" } : null;
}
