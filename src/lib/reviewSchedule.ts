export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;

export type ReviewInterval = typeof REVIEW_INTERVALS[number];

export type ReviewHistoryItem = {
  id: string;
  lessonId: string;
  date: string;
  completedAt?: string;
};

export type ScheduledReview = {
  lessonId: string;
  interval: ReviewInterval;
  dueDate: string;
  isDue: boolean;
  lastRecall?: { rating: RecallRating; date: string };
};

export function reviewCompletionId(lessonId: string, interval: ReviewInterval): string {
  return `review:${interval}:${lessonId}`;
}

export const RECALL_RATINGS = ["again", "hard", "remembered"] as const;
export type RecallRating = typeof RECALL_RATINGS[number];

// Extend the existing ID metadata contract; sync and backups already preserve it unchanged.
export function recallCompletionId(rating: RecallRating, nextInterval: ReviewInterval): string {
  return `review:recall:${rating}:${nextInterval}:${crypto.randomUUID()}`;
}

export function parseRecall(id: string): { rating: RecallRating; interval: ReviewInterval } | null {
  const match = /^review:recall:(again|hard|remembered):(1|3|7|14):[0-9a-f-]{36}$/.exec(id);
  return match ? { rating: match[1] as RecallRating, interval: Number(match[2]) as ReviewInterval } : null;
}

export function recallInterval(current: ReviewInterval, rating: RecallRating, delayed: boolean): ReviewInterval {
  if (!delayed || rating === "again") return 1;
  if (rating === "hard") return current;
  return REVIEW_INTERVALS[Math.min(REVIEW_INTERVALS.indexOf(current) + 1, REVIEW_INTERVALS.length - 1)];
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

  const latestRecall = history.filter(item => item.lessonId === lessonId && item.date >= original.date && parseRecall(item.id))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || b.id.localeCompare(a.id))[0];
  if (latestRecall) {
    const recall = parseRecall(latestRecall.id)!;
    const dueDate = addDays(latestRecall.date, recall.interval);
    return { lessonId, interval: recall.interval, dueDate, isDue: dueDate <= today,
      lastRecall: { rating: recall.rating, date: latestRecall.date } };
  }

  let previousDate = original.date;
  for (const interval of REVIEW_INTERVALS) {
    const completed = history.find((item) => item.id === reviewCompletionId(lessonId, interval));
    if (!completed) {
      const dueDate = addDays(previousDate, interval);
      return { lessonId, interval, dueDate, isDue: dueDate <= today };
    }
    previousDate = completed.date;
  }
  const dueDate = addDays(previousDate, 14);
  return { lessonId, interval: 14, dueDate, isDue: dueDate <= today };
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
