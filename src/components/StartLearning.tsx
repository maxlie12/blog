"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLanguageLabel } from "@/lib/languages";
import { getLocalCompletedLessonIds } from "@/lib/localLearningProgress";
import { readProfileStorage } from "@/lib/learnerProfiles";
import type { LessonSummary } from "@/lib/lessonTypes";
import { selectNextLesson, type NextLesson } from "@/lib/nextLesson";
import { useLearnerProfile } from "@/lib/useLearnerProfile";

function hasSavedDraft(lessonId: string): boolean {
  try {
    const raw = readProfileStorage("learning-practice-v1:" + lessonId);
    if (!raw) return false;
    const value = JSON.parse(raw) as { version?: unknown; lessonId?: unknown; response?: unknown };
    return value.version === 1 && value.lessonId === lessonId && typeof value.response === "string" && Boolean(value.response.trim());
  } catch {
    return false;
  }
}

const actionLabel = {
  resume: "Tiếp tục bài đang dở",
  next: "Bắt đầu học",
  review: "Ôn lại một bài",
} as const;

const reasonLabel = {
  resume: "Bạn có bản nháp chưa Done. Hệ thống giữ đúng bài đó để không mất mạch học.",
  next: "Đây là bài chưa Done phù hợp tiếp theo trong lộ trình hiện tại.",
  review: "Bạn đã Done toàn bộ bài hiện có. Hệ thống chọn lại bài đầu lộ trình để ôn.",
} as const;

export function StartLearning({ lessons }: { lessons: LessonSummary[] }) {
  const learner = useLearnerProfile();
  const [target, setTarget] = useState<NextLesson | null>(null);

  useEffect(() => {
    const choose = () => {
      const completed = getLocalCompletedLessonIds();
      const drafts = new Set(lessons.filter((lesson) => hasSavedDraft(lesson.id)).map((lesson) => lesson.id));
      setTarget(selectNextLesson(lessons, learner.id, completed, drafts));
    };
    choose();
    window.addEventListener("learning-progress-changed", choose);
    return () => window.removeEventListener("learning-progress-changed", choose);
  }, [learner.id, lessons]);

  return (
    <section className="learning-start" aria-labelledby="learning-start-title">
      <div>
        <p className="eyebrow">Gợi ý cho {learner.name} · 5–10 phút</p>
        <h2 id="learning-start-title">Không cần chọn — bắt đầu từ bài phù hợp nhất</h2>
        {target ? (
          <div className="learning-start__selection" aria-live="polite">
            <strong>{target.lesson.title}</strong>
            <span>{getLanguageLabel(target.lesson.language, true)} · {target.lesson.level}</span>
            <p>{reasonLabel[target.reason]}</p>
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
        <small>Có thể đổi bài bằng bộ lọc bên dưới.</small>
      </div>
    </section>
  );
}
