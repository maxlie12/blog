"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletedLessonIds, getLocalDueReviews } from "@/lib/localLearningProgress";
import { hasLessonDraft, dailyLessonDate } from "@/lib/localLessonState";
import type { LessonSummary } from "@/lib/lessonTypes";
import { selectNextLesson, type NextLesson } from "@/lib/nextLesson";
import type { ScheduledReview } from "@/lib/reviewSchedule";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { StudyBrief } from "./StudyBrief";

const actionLabel = {
  resume: "Tiếp tục bài đang dở",
  "due-review": "Ôn bài đến hạn",
  next: "Bắt đầu học",
  review: "Ôn lại một bài",
} as const;

// Thứ tự đọc trong thẻ: trạng thái → tên bài → một dòng thông tin → một câu lý do; chi tiết thu gọn.
const statusLabel = {
  resume: "Đang làm dở",
  "due-review": "Đến hạn ôn",
  next: "Bài mới",
  review: "Ôn lại",
} as const;

const reasonLabel = {
  resume: "Bạn có bản nháp chưa Done — làm tiếp để không mất mạch học.",
  "due-review": "Đến hạn ôn: tự nhớ lại trước, rồi mới mở phần đối chiếu và tự chấm.",
  next: "Bài chưa làm tiếp theo trong lộ trình của bạn.",
  review: "Bạn đã Done hết bài hiện có — ôn lại từ đầu lộ trình.",
} as const;

const skillLabel: Record<string, string> = { listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói" };

export function StartLearning({ lessons }: { lessons: LessonSummary[] }) {
  const learner = useLearnerProfile();
  const [target, setTarget] = useState<NextLesson | null>(null);
  const [englishTarget, setEnglishTarget] = useState<NextLesson | null>(null);
  const [chineseTarget, setChineseTarget] = useState<NextLesson | null>(null);
  const [dueReview, setDueReview] = useState<{ review: ScheduledReview; title: string } | null>(null);
  const [lessonIds] = useState(() => new Set(lessons.filter((lesson) => lesson.language === "en").map((lesson) => lesson.id)));

  useEffect(() => {
    const choose = () => {
      const completed = getLocalCompletedLessonIds();
      const dueReviews = getLocalDueReviews();
      const drafts = new Set(lessons.filter((lesson) => hasLessonDraft(lesson.id)).map((lesson) => lesson.id));
      const next = selectNextLesson(lessons, learner.id, completed, drafts, dueReviews);
      setTarget(next);
      setEnglishTarget(selectNextLesson(lessons.filter(lesson => lesson.language === "en"), learner.id, completed, drafts, dueReviews));
      // Show an independent Chinese entry point so the English-first path cannot bury Chinese practice.
      setChineseTarget(selectNextLesson(lessons.filter((lesson) => lesson.language === "zh"), learner.id, completed, drafts, dueReviews));
      // An unfinished draft remains first; its due review stays one tap away.
      const review = next?.reason === "due-review" ? undefined : dueReviews.find((item) => lessons.some((l) => l.id === item.lessonId));
      const title = review && lessons.find((l) => l.id === review.lessonId)?.title;
      setDueReview(review && title ? { review, title } : null);
    };
    choose();
    window.addEventListener("learning-progress-changed", choose);
    return () => window.removeEventListener("learning-progress-changed", choose);
  }, [learner.id, lessons]);

  const daily = target ? dailyLessonDate(target.lesson.id) : null;
  return (
    <>
    <section className="learning-start" aria-labelledby="learning-start-title">
      <div>
        <p className="eyebrow">BÀI DAILY · 5–10 PHÚT</p>
        <h2 id="learning-start-title">Tiếp tục từ việc quan trọng nhất</h2>
        {target ? (
          <div className="learning-start__selection" aria-live="polite">
            <p className="learning-start__status" data-reason={target.reason}>{statusLabel[target.reason]}</p>
            <strong className="learning-start__title">{target.lesson.title}</strong>
            <span>
              {getLanguageLabel(target.lesson.language, true)} · {target.lesson.level} · {skillLabel[target.lesson.skill] ?? target.lesson.skill}
              {" · "}{daily ? `Daily ${daily}` : "Bài theo chủ đề"}
            </span>
            <p>{reasonLabel[target.reason]}</p>
            <details className="learning-start__more">
              <summary>Bài này gồm gì?</summary>
              <p><strong>Mục tiêu:</strong> {target.lesson.exercises}</p>
              {target.review && <p><strong>Lịch ôn:</strong> mốc +{target.review.interval} ngày · đến hạn {target.review.dueDate}</p>}
              <p>Done là bạn tự báo để giữ thói quen, không phải điểm trình độ.</p>
            </details>
          </div>
        ) : (
          <p aria-live="polite">Đang đọc tiến độ trên thiết bị để chọn bài…</p>
        )}
      </div>
      <div className="learning-start__action">
        {target ? (
          <Link className="button button--primary" href={`/learning/${target.lesson.id}`} aria-label={`${actionLabel[target.reason]}: ${target.lesson.title}`}>
            {actionLabel[target.reason]} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button className="button button--primary" type="button" disabled>Đang chọn bài…</button>
        )}
        {englishTarget && target?.lesson.language !== "en" && (
          <Link className="button button--ghost" href={`/learning/${englishTarget.lesson.id}`} aria-label={`${actionLabel[englishTarget.reason]} tiếng Anh: ${englishTarget.lesson.title}`}>
            Tiếng Anh · {actionLabel[englishTarget.reason]} →
          </Link>
        )}
        {chineseTarget && target?.lesson.language !== "zh" && (
          <Link className="button button--ghost" href={`/learning/${chineseTarget.lesson.id}`} aria-label={`${actionLabel[chineseTarget.reason]} tiếng Trung: ${chineseTarget.lesson.title}`}>
            Tiếng Trung · {actionLabel[chineseTarget.reason]} →
          </Link>
        )}
        {dueReview && (
          <small>Đến hạn ôn: <Link href={`/learning/${dueReview.review.lessonId}`}>{dueReview.title}</Link> (+{dueReview.review.interval} ngày)</small>
        )}
        <Link className="button button--ghost" href="/learning/daily">Đổi bài · xem Daily theo ngày →</Link>
        <small>Hôm nay không làm bài được? <Link href="/learning/practice">Tự luyện từ mới và đọc to</Link>.</small>
      </div>
    </section>
    <StudyBrief lessonIds={lessonIds} nextDaily={englishTarget ? englishTarget.lesson.title : null} />
    </>
  );
}
