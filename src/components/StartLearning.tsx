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

const actionLabel = {
  resume: "Tiếp tục bài đang dở",
  "due-review": "Ôn bài đến hạn",
  next: "Bắt đầu học",
  review: "Ôn lại một bài",
} as const;

const reasonLabel = {
  resume: "Bạn có bản nháp chưa Done. Hệ thống giữ đúng bài đó để không mất mạch học.",
  "due-review": "Bài này đến hạn ôn. Nhớ lại ngắn trước khi học bài mới; lịch tiếp theo dựa trên kết quả bạn tự kiểm tra.",
  next: "Đây là bài chưa Done phù hợp tiếp theo trong lộ trình hiện tại.",
  review: "Bạn đã Done toàn bộ bài hiện có. Hệ thống chọn lại bài đầu lộ trình để ôn.",
} as const;

export function StartLearning({ lessons }: { lessons: LessonSummary[] }) {
  const learner = useLearnerProfile();
  const [target, setTarget] = useState<NextLesson | null>(null);
  const [chineseTarget, setChineseTarget] = useState<NextLesson | null>(null);
  const [dueReview, setDueReview] = useState<{ review: ScheduledReview; title: string } | null>(null);

  useEffect(() => {
    const choose = () => {
      const completed = getLocalCompletedLessonIds();
      const dueReviews = getLocalDueReviews();
      const drafts = new Set(lessons.filter((lesson) => hasLessonDraft(lesson.id)).map((lesson) => lesson.id));
      const next = selectNextLesson(lessons, learner.id, completed, drafts, dueReviews);
      setTarget(next);
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

  return (
    <section className="learning-start" aria-labelledby="learning-start-title">
      <div>
        <p className="eyebrow">PHIÊN HỌC TIẾP THEO · 5–10 PHÚT</p>
        <h2 id="learning-start-title">Tiếp tục từ việc quan trọng nhất</h2>
        {target ? (
          <div className="learning-start__selection" aria-live="polite">
            <strong>{target.lesson.title}</strong>
            <span>{getLanguageLabel(target.lesson.language, true)} · {target.lesson.level}</span>
            <span>{dailyLessonDate(target.lesson.id) ? `Daily ${dailyLessonDate(target.lesson.id)}` : "Bài luyện theo chủ đề/cấp độ"} · {target.lesson.skill}</span>
            <p><strong>Mục tiêu:</strong> {target.lesson.exercises}</p>
            <small>{target.reason === "resume" ? "Đang học · đã có bản nháp" : target.reason === "review" || target.reason === "due-review" ? "Đã Done · đang ôn lại" : "Chưa Done"}. Done là tự báo, không phải điểm trình độ.</small>
            <p>{reasonLabel[target.reason]}</p>
            {target.review && <small>Mốc ôn +{target.review.interval} ngày · đến hạn {target.review.dueDate}</small>}
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
        {chineseTarget && (
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
  );
}
