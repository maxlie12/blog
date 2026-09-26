"use client";

import { useProgress } from "@/lib/progress";
import Link from "next/link";

// Self-tracked, browser-local goal — not verified or synced. See docs/DECISIONS.md.
const DAILY_GOAL = 3;

export function DailyGoalWidget() {
  const { completedToday } = useProgress();
  const pct = Math.min(100, Math.round((completedToday / DAILY_GOAL) * 100));

  return (
    <div className="daily-goal">
      <div className="daily-goal__header">
        <span className="daily-goal__icon" aria-hidden="true">
          ◎
        </span>
        <span>Daily goal</span>
        <span className="daily-goal__count">
          {completedToday}/{DAILY_GOAL}
        </span>
      </div>
      <div
        className="daily-goal__bar"
        role="progressbar"
        aria-valuenow={completedToday}
        aria-valuemin={0}
        aria-valuemax={DAILY_GOAL}
      >
        <div className="daily-goal__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="daily-goal__hint">
        {completedToday >= DAILY_GOAL
          ? "Goal met for today — nice work."
          : "Keep going! Consistency beats intensity."}
      </p>
      <Link href="/learning" className="daily-goal__cta">
        Continue learning →
      </Link>
    </div>
  );
}
