import { LANGUAGES } from "@/lib/languages";
import Link from "next/link";
import { SKILLS, type SkillId } from "@/lib/lessonTypes";
import { AttemptSubmitForm } from "@/components/AttemptSubmitForm";
import { PracticeCoach } from "@/components/PracticeCoach";
import { ReviewCompletion } from "@/components/ReviewCompletion";
import { LessonTakeaway } from "@/components/LessonTakeaway";
import { LessonFlowGuide, LessonSourceAction } from "@/components/LessonFlowGuide";
import type { ChinesePractice, LessonTakeaway as LessonTakeawayContent } from "@/lib/dailyLessons";

interface AttemptView {
  id: string;
  date: string;
  reviewStatus: string;
}

const AUDIO_EXTENSION = /\.(mp3|wav|ogg|m4a|webm)(\?.*)?$/i;

function isAudioUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && AUDIO_EXTENSION.test(value);
}

// A lesson may use one of this site's own articles as its source.
function isSourceLink(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value) || /^\/blog\/[a-z0-9-]+$/.test(value);
}

function getSourceLabel(value: string): string {
  if (value.startsWith("/blog/")) return "blog Field Notes";
  try {
    const hostname = new URL(value).hostname;
    if (hostname.includes("britishcouncil.org")) return "British Council";
    if (hostname.includes("cambridgeenglish.org")) return "Cambridge English";
    if (hostname.includes("hellochinese.cc")) return "HelloChinese";
    if (hostname.includes("duchinese.net")) return "Du Chinese";
    if (hostname.includes("irodori.jpf.go.jp")) return "Irodori";
  } catch {
    return "Nguồn bài học";
  }
  return "Nguồn bài học";
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
    takeaway?: LessonTakeawayContent;
    chinesePractice?: ChinesePractice;
  };
  attempts: AttemptView[];
  canSubmit: boolean;
}) {
  const reviewedCount = attempts.filter((a) => a.reviewStatus === "reviewed").length;
  const externalSource = lesson.material && isSourceLink(lesson.material) && !isAudioUrl(lesson.material)
    ? lesson.material
    : null;

  return (
    <article className="lesson-detail" id="lesson-start">
      <Link href="/learning" className="lesson-detail__back">
        ← Về Learning
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

      <LessonFlowGuide lessonId={lesson.id} language={lesson.language} sourceUrl={externalSource} />

      <section className="lesson-detail__section">
        <p className="lesson-step-kicker">BƯỚC 1 · MỤC TIÊU</p>
        <h2>Biết mình cần làm gì trước khi mở nguồn</h2>
        <p>{lesson.instructions}</p>
      </section>

      {lesson.material && (
        <section className="lesson-detail__section">
          <p className="lesson-step-kicker">BƯỚC 2 · BÀI HỌC CHÍNH</p>
          <h2>Đọc nhiệm vụ trước, rồi mở nguồn để học</h2>
          {lesson.exercises && (
            <div className="lesson-source-task">
              <strong>Nhiệm vụ cần trả lời</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{lesson.exercises}</p>
            </div>
          )}
          {lesson.skill === "listening" && isAudioUrl(lesson.material) ? (
            <audio controls src={lesson.material} className="lesson-detail__audio" />
          ) : (
            isSourceLink(lesson.material) ?
              <LessonSourceAction lessonId={lesson.id} href={lesson.material} label={getSourceLabel(lesson.material)} /> :
              <p style={{ whiteSpace: "pre-wrap" }}>{lesson.material}</p>
          )}
        </section>
      )}

      {!lesson.material && lesson.exercises && (
        <section className="lesson-detail__section">
          <p className="lesson-step-kicker">BƯỚC 2 · BÀI HỌC CHÍNH</p>
          <h2>Nhiệm vụ cần trả lời</h2>
          <div className="lesson-source-task">
            <p style={{ whiteSpace: "pre-wrap" }}>{lesson.exercises}</p>
          </div>
        </section>
      )}

      {attempts.length > 0 && <div className="lesson-detail__actions">
        {reviewedCount > 0 ? (
          <p className="lesson-detail__status" role="status">
            ✓ Đã hoàn thành — {reviewedCount} bài đã được review
          </p>
        ) : (
          <p className="lesson-detail__status lesson-detail__status--pending" role="status">
            {attempts.length} bài đã nộp, đang chờ review
          </p>
        )}
      </div>}

      {!canSubmit && <PracticeCoach key={lesson.id} lessonId={lesson.id} skill={lesson.skill} language={lesson.language} takeaway={lesson.takeaway} chinesePractice={lesson.chinesePractice} />}

      {canSubmit ? (
        <section className="lesson-detail__section lesson-detail__submit">
          <h2>Bước 3 · Tạo đầu ra và nộp bài</h2>
          <AttemptSubmitForm lessonId={lesson.id} skill={lesson.skill} language={lesson.language} />
        </section>
      ) : null}

      {canSubmit && lesson.takeaway && <LessonTakeaway lessonId={lesson.id} language={lesson.language} takeaway={lesson.takeaway} />}

      <ReviewCompletion lessonId={lesson.id} skill={lesson.skill} language={lesson.language} />

      {attempts.length > 0 && (
        <section className="lesson-detail__section">
          <h2>Bài đã nộp</h2>
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
        Done chỉ ghi nhận thói quen tự học (mỗi bài một lần); trình độ CEFR/HSK/JLPT chỉ dựa trên bài đã được review.
      </p>
    </article>
  );
}
