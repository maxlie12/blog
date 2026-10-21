import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttemptWithLesson, SKILLS } from "@/lib/lessonsData";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { hasStudioSession } from "@/lib/studioSession";
import { canReadAttempt } from "@/lib/attemptAccess";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}): Promise<Metadata> {
  const [studioSession, learnerId] = await Promise.all([hasStudioSession(), getAuthenticatedLearnerId()]);
  const { attemptId } = await params;
  const attempt = await getAttemptWithLesson(attemptId);
  return { title: attempt && canReadAttempt(attempt.learnerId, learnerId, studioSession) ? `Attempt: ${attempt.lesson.title}` : "Attempt" };
}

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string; attemptId: string }>;
}) {
  const [studioSession, learnerId] = await Promise.all([hasStudioSession(), getAuthenticatedLearnerId()]);
  const { lessonId, attemptId } = await params;
  const attempt = await getAttemptWithLesson(attemptId);
  if (!attempt || attempt.lessonId !== lessonId || !canReadAttempt(attempt.learnerId, learnerId, studioSession)) notFound();

  return (
    <article className="lesson-detail">
      <Link href={`/learning/${lessonId}`} className="lesson-detail__back">
        ← Back to {attempt.lesson.title}
      </Link>

      <header className="lesson-detail__header">
        <div className="lesson-detail__meta">
          <span className="tag">{SKILLS.find((s) => s.id === attempt.lesson.skill)?.label}</span>
          <span className={`status-pill status-pill--${attempt.reviewStatus}`}>
            {attempt.reviewStatus}
          </span>
        </div>
        <h1>Attempt — {attempt.date}</h1>
        <p className="lesson-detail__summary">
          Submitted for &ldquo;{attempt.lesson.title}&rdquo;.
        </p>
      </header>

      <section className="lesson-detail__section">
        <h2>Your submitted answer</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{attempt.response || "(no answer text)"}</p>
      </section>

      {attempt.feedback && (
        <section className="lesson-detail__section lesson-detail__sample">
          <h2>Feedback</h2>
          <p>{attempt.feedback}</p>
        </section>
      )}

      <p className="lesson-detail__disclaimer">
        {attempt.reviewStatus === "reviewed"
          ? "This attempt has been reviewed and counts toward this lesson's completion."
          : "This attempt is saved and persists across devices, but hasn't been reviewed yet — it doesn't count toward completion until it is."}
      </p>
    </article>
  );
}
