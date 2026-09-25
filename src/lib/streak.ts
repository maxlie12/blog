/**
 * Streak = consecutive calendar days (site timezone) with at least one
 * LearningLog row, public or private. Publishing status never affects
 * whether a day counts — see docs/ARCHITECTURE.md#streaks.
 */
export function computeStreaks(dates: string[]): { current: number; longest: number } {
  const uniqueSorted = Array.from(new Set(dates)).sort();
  if (uniqueSorted.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    if (isNextDay(uniqueSorted[i - 1], uniqueSorted[i])) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const today = todayInTz();
  const yesterday = addDays(today, -1);
  const last = uniqueSorted[uniqueSorted.length - 1];

  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = uniqueSorted.length - 1; i > 0; i--) {
      if (isNextDay(uniqueSorted[i - 1], uniqueSorted[i])) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

function isNextDay(a: string, b: string): boolean {
  return addDays(a, 1) === b;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayInTz(): string {
  const tz = process.env.SITE_TIMEZONE || "UTC";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}
