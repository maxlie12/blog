export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;

export type ReviewInterval = typeof REVIEW_INTERVALS[number];

export type ReviewHistoryItem = {
  id: string;
  lessonId: string;
  date: string;
};

export type ScheduledReview = {
  lessonId: string;
  interval: ReviewInterval;
  dueDate: string;
  isDue: boolean;
};

export function reviewCompletionId(lessonId: string, interval: ReviewInterval): string {
  return `review:${interval}:${lessonId}`;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function nextScheduledReview(
  history: readonly ReviewHistoryItem[],
  lessonId: string,
  today: string,
): ScheduledReview | null {
  const original = history.find((item) => item.lessonId === lessonId && item.id === `lesson:${lessonId}`);
  if (!original) return null;

  let previousDate = original.date;
  for (const interval of REVIEW_INTERVALS) {
    const completed = history.find((item) => item.id === reviewCompletionId(lessonId, interval));
    if (!completed) {
      const dueDate = addDays(previousDate, interval);
      return { lessonId, interval, dueDate, isDue: dueDate <= today };
    }
    previousDate = completed.date;
  }
  return null;
}

export function dueReviews(history: readonly ReviewHistoryItem[], today: string): ScheduledReview[] {
  const lessonIds = new Set(
    history
      .filter((item) => item.id === `lesson:${item.lessonId}`)
      .map((item) => item.lessonId),
  );

  return [...lessonIds]
    .map((lessonId) => nextScheduledReview(history, lessonId, today))
    .filter((review): review is ScheduledReview => Boolean(review?.isDue))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.lessonId.localeCompare(b.lessonId));
}
