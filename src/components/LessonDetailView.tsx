"use client";

import Link from "next/link";
import type { Lesson } from "@/data/lessons";
import { useProgress } from "@/lib/progress";

export function LessonDetailView({ lesson }: { lesson: Lesson }) {
  const { isComplete, markComplete, markIncomplete } = useProgress();
  const done = isComplete(lesson.id);

  return (
    <article className="lesson-detail">
      <Link href="/learning" className="lesson-detail__back">
        ← Back to lessons
      </Link>

      <header className="lesson-detail__header">
        <div className="lesson-detail__meta">
          <span className="tag">{lesson.skill}</span>
          <span className="tag tag--level">{lesson.level}</span>
          <span>~{lesson.minutes} min</span>
        </div>
        <h1>{lesson.title}</h1>
        <p className="lesson-detail__summary">{lesson.summary}</p>
      </header>

      <section className="lesson-detail__section">
        <h2>Prompt</h2>
        <p>{lesson.prompt}</p>
      </section>

      <section className="lesson-detail__section lesson-detail__sample">
        <h2>Sample response</h2>
        <p>{lesson.sample}</p>
        <p className="lesson-detail__note">
          This is one possible answer, not a scored model — compare it to your own attempt
          rather than copying it.
        </p>
      </section>

      <div className="lesson-detail__actions">
        {done ? (
          <>
            <p className="lesson-detail__status" role="status">
              ✓ Marked complete
            </p>
            <button type="button" className="button button--ghost" onClick={() => markIncomplete(lesson.id)}>
              Mark as not done
            </button>
          </>
        ) : (
          <button type="button" className="button button--primary" onClick={() => markComplete(lesson.id)}>
            Mark complete
          </button>
        )}
      </div>
      <p className="lesson-detail__disclaimer">
        Completion is saved only in this browser (not synced across devices) and is
        self-reported — it isn&apos;t a verified language assessment.
      </p>
    </article>
  );
}
