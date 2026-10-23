"use client";

import { useEffect, useState } from "react";
import type { LessonTakeaway as LessonTakeawayContent } from "@/lib/dailyLessons";
import { getLocalCompletionSummary } from "@/lib/localLearningProgress";
import { useLearnerProfile } from "@/lib/useLearnerProfile";

export function LessonTakeaway({
  lessonId,
  language,
  takeaway,
}: {
  lessonId: string;
  language: string;
  takeaway: LessonTakeawayContent;
}) {
  const learner = useLearnerProfile();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setCompleted(getLocalCompletionSummary("lesson:" + lessonId, language).completed);
    };
    queueMicrotask(refresh);
    window.addEventListener("learning-progress-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("learning-progress-changed", refresh);
    };
  }, [language, learner.id, lessonId]);

  if (!completed) return null;

  return (
    <section className="lesson-takeaway" aria-labelledby="lesson-takeaway-title">
      <p className="lesson-step-kicker">BƯỚC 4 · MANG ĐI</p>
      <h2 id="lesson-takeaway-title">Hôm nay chỉ cần giữ lại 3 điều</h2>
      <dl className="lesson-takeaway__list">
        <div>
          <dt>Cụm dùng được ngay</dt>
          <dd>{takeaway.phrase}</dd>
        </div>
        <div>
          <dt>Khung câu</dt>
          <dd>{takeaway.pattern}</dd>
        </div>
        <div>
          <dt>Luyện chuyển tình huống</dt>
          <dd>{takeaway.reusePrompt}</dd>
        </div>
      </dl>
      <p className="lesson-takeaway__note">Đây là phần ghi nhớ của bài, không phải điểm số hay xác nhận trình độ.</p>
    </section>
  );
}
