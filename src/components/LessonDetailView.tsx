import Link from "next/link";
import { SKILLS, type SkillId } from "@/lib/lessonsData";

interface AttemptView {
  id: string;
  date: string;
  reviewStatus: string;
}

export function LessonDetailView({
  lesson,
  attempts,
}: {
  lesson: {
    id: string;
    skill: SkillId;
    title: string;
    level: string;
    instructions: string;
    material: string | null;
    exercises: string | null;
    completionCriteria: string;
  };
  attempts: AttemptView[];
}) {
  const reviewedCount = attempts.filter((a) => a.reviewStatus === "reviewed").length;

  return (
    <article className="lesson-detail">
      <Link href="/learning" className="lesson-detail__back">
        ← Back to lessons
      </Link>

      <header className="lesson-detail__header">
        <div className="lesson-detail__meta">
          <span className="tag">{SKILLS.find((s) => s.id === lesson.skill)?.label}</span>
          <span className="tag tag--level">{lesson.level}</span>
        </div>
        <h1>{lesson.title}</h1>
        <p className="lesson-detail__summary">{lesson.completionCriteria}</p>
      </header>

      <section className="lesson-detail__section">
        <h2>Instructions</h2>
        <p>{lesson.instructions}</p>
      </section>

      {lesson.material && (
        <section className="lesson-detail__section">
          <h2>Material</h2>
          <p>{lesson.material}</p>
        </section>
      )}

      {lesson.exercises && (
        <section className="lesson-detail__section lesson-detail__sample">
          <h2>Exercise</h2>
          <p>{lesson.exercises}</p>
        </section>
      )}

      <div className="lesson-detail__actions">
        {reviewedCount > 0 ? (
          <p className="lesson-detail__status" role="status">
            ✓ Completed — {reviewedCount} reviewed attempt{reviewedCount === 1 ? "" : "s"}
          </p>
        ) : attempts.length > 0 ? (
          <p className="lesson-detail__status lesson-detail__status--pending" role="status">
            {attempts.length} attempt{attempts.length === 1 ? "" : "s"} logged, awaiting review
          </p>
        ) : (
          <p className="lesson-detail__status lesson-detail__status--pending" role="status">
            No attempts yet
          </p>
        )}
      </div>
      <p className="lesson-detail__disclaimer">
        Attempts are recorded and reviewed privately in Studio — this page is read-only. This
        reflects real, tracked practice, not a self-reported checkbox.
      </p>
    </article>
  );
}
