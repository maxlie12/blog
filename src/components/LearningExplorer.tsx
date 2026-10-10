"use client";

import { LANGUAGES } from "@/lib/languages";
import Link from "next/link";
import { useMemo } from "react";
import { SKILLS, type SkillId, type LessonSummary } from "@/lib/lessonTypes";
import { useLessonFilter } from "@/lib/lessonFilter";

const SKILL_ICON: Record<SkillId, string> = {
  writing: "✎",
  listening: "◐",
  speaking: "◔",
  reading: "▤",
};

/** Selecting a skill card filters the lesson list — state lives in LessonFilterProvider so
 * these two components can sit in different layout regions (e.g. separate grid columns on
 * the homepage) while staying in sync. Lessons/progress come from the database via props,
 * not a static import — see src/lib/lessonsData.ts. */
export function SkillCards({
  lessons,
}: {
  lessons: LessonSummary[];
}) {
  const { filter, setFilter, language } = useLessonFilter();

  return (
    <div className="skill-cards" role="group" aria-label="Filter lessons by skill">
      {SKILLS.map((skill) => {
        const selected = lessons.filter((l) => l.language === language && l.skill === skill.id);
        const total = selected.length;
        const completed = selected.filter((l) => l.reviewedCount > 0).length;
        const active = filter === skill.id;
        return (
          <button
            key={skill.id}
            type="button"
            className="skill-card"
            data-active={active || undefined}
            aria-pressed={active}
            onClick={() => setFilter(active ? "all" : skill.id)}
          >
            <span className="skill-card__icon" aria-hidden="true">
              {SKILL_ICON[skill.id]}
            </span>
            <span className="skill-card__body">
              <span className="skill-card__title-row">
                <span className="skill-card__title">{skill.label}</span>
                <span className="skill-card__count">
                  {completed}/{total}
                </span>
              </span>
              <span className="skill-card__progress" aria-hidden="true">
                <span
                  className="skill-card__progress-fill"
                  style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                />
              </span>
              <span className="skill-card__desc">{skill.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LessonPicker({
  lessons,
  compact = false,
}: {
  lessons: LessonSummary[];
  compact?: boolean;
}) {
  const { filter, setFilter, language, setLanguage } = useLessonFilter();
  const visible = useMemo(
    () => lessons.filter((l) => l.language === language && (filter === "all" || l.skill === filter)),
    [lessons, filter, language]
  );

  return (
    <div className="lesson-picker">
      {!compact && (
        <div className="lesson-picker__header">
          <h2>Choose a lesson</h2>
          <p>Practice with real-world content, step by step.</p>
        </div>
      )}

      <label className="field">
        <span>Language</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "zh")}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>

      <div className="lesson-picker__filters" role="tablist" aria-label="Filter by skill">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          data-active={filter === "all" || undefined}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            type="button"
            role="tab"
            aria-selected={filter === skill.id}
            data-active={filter === skill.id || undefined}
            onClick={() => setFilter(skill.id)}
          >
            {skill.label}
          </button>
        ))}
      </div>

      <ul className="lesson-picker__list">
        {visible.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/learning/${lesson.id}`} className="lesson-item">
              <span className="lesson-item__icon" aria-hidden="true">
                {SKILL_ICON[lesson.skill]}
              </span>
              <span className="lesson-item__body">
                <span className="lesson-item__title-row">
                  <span className="lesson-item__title">{lesson.title}</span>
                  {lesson.reviewedCount > 0 && (
                    <span className="lesson-item__done" title="Completed">
                      ✓
                    </span>
                  )}
                </span>
                <span className="lesson-item__meta">
                  <span className="tag">{SKILLS.find((s) => s.id === lesson.skill)?.label}</span>
                  <span className="tag tag--level">{lesson.level}</span>
                  {lesson.attemptCount > 0 && (
                    <span className="lesson-item__minutes">
                      {lesson.attemptCount} attempt{lesson.attemptCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
                <span className="lesson-item__summary">{lesson.completionCriteria}</span>
              </span>
              <span className="lesson-item__chevron" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="lesson-picker__empty">No lessons in this skill yet.</li>
        )}
      </ul>
    </div>
  );
}
