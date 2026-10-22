import { LANGUAGES } from "@/lib/languages";
import Link from "next/link";
import { SKILLS, type SkillId } from "@/lib/lessonTypes";
import { AttemptSubmitForm } from "@/components/AttemptSubmitForm";
import { PracticeCoach } from "@/components/PracticeCoach";
import { ReviewCompletion } from "@/components/ReviewCompletion";

interface AttemptView {
  id: string;
  date: string;
  reviewStatus: string;
}

const AUDIO_EXTENSION = /\.(mp3|wav|ogg|m4a|webm)(\?.*)?$/i;

function isAudioUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && AUDIO_EXTENSION.test(value);
}

export function LessonDetailView({
  lesson,
  attempts,
  canSubmit,
}: {
  lesson: {
    id: string;
    skill: SkillId;
    language: string;
    title: string;
    level: string;
    instructions: string;
    material: string | null;
    exercises: string | null;
    completionCriteria: string;
  };
  attempts: AttemptView[];
  canSubmit: boolean;
}) {
  const reviewedCount = attempts.filter((a) => a.reviewStatus === "reviewed").length;

  return (
    <article className="lesson-detail">
      <Link href="/learning" className="lesson-detail__back">
        ← Back to lessons
      </Link>

      <header className="lesson-detail__header">
        <div className="lesson-detail__meta">
          <span className="tag">{LANGUAGES.find((l) => l.id === lesson.language)?.label ?? lesson.language}</span>
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
          {lesson.skill === "listening" && isAudioUrl(lesson.material) ? (
            <audio controls src={lesson.material} className="lesson-detail__audio" />
          ) : (
            /^https?:\/\/\S+$/i.test(lesson.material) ?
              <a href={lesson.material} target="_blank" rel="noopener noreferrer">Mở nguồn bài học ↗</a> :
              <p style={{ whiteSpace: "pre-wrap" }}>{lesson.material}</p>
          )}
        </section>
      )}

      {lesson.exercises && (
        <section className="lesson-detail__section lesson-detail__sample">
          <h2>Exercise</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{lesson.exercises}</p>
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
            Chưa có bài nộp lên server; tiến độ tự học trên thiết bị hiển thị bên dưới
          </p>
        )}
      </div>

      {!canSubmit && <PracticeCoach key={lesson.id} lessonId={lesson.id} skill={lesson.skill} language={lesson.language} />}

      {canSubmit ? (
        <section className="lesson-detail__section lesson-detail__submit">
          <h2>Submit an attempt</h2>
          <AttemptSubmitForm lessonId={lesson.id} skill={lesson.skill} language={lesson.language} />
        </section>
      ) : (
        <p className="lesson-detail__disclaimer">
          Bản viết chỉ lưu trên trình duyệt. Metadata Done và streak được đồng bộ khi máy chủ sẵn sàng; review và điểm CEFR vẫn là luồng riêng.
        </p>
      )}

      <ReviewCompletion lessonId={lesson.id} skill={lesson.skill} language={lesson.language} />

      {attempts.length > 0 && (
        <section className="lesson-detail__section">
          <h2>Attempt history</h2>
          <ul className="attempt-history">
            {attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/learning/${lesson.id}/attempts/${a.id}`}>
                  <span>{a.date}</span>
                  <span className={`status-pill status-pill--${a.reviewStatus}`}>
                    {a.reviewStatus}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="lesson-detail__disclaimer">
        Nút Done ghi nhận thói quen tự học và streak trên thiết bị; mỗi bài chỉ được ghi một lần.
        Điểm CEFR hoặc trạng thái reviewed vẫn cần bài làm thực tế và phản hồi riêng.
      </p>
    </article>
  );
}
