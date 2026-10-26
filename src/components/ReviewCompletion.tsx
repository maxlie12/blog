"use client";

import { useEffect, useState } from "react";
import { getLocalScheduledReview, recordLocalReview, syncLocalProgress } from "@/lib/localLearningProgress";
import type { SkillId } from "@/lib/lessonTypes";
import type { ScheduledReview } from "@/lib/reviewSchedule";

export function ReviewCompletion({
  lessonId,
  language,
  skill,
}: {
  lessonId: string;
  language: string;
  skill: SkillId;
}) {
  const [review, setReview] = useState<ScheduledReview | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setReview(getLocalScheduledReview(lessonId));
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    return () => window.removeEventListener("learning-progress-changed", refresh);
  }, [lessonId]);

  function finishReview() {
    const result = recordLocalReview({ lessonId, language, skill, minutes: 3 });
    setReview(result.nextReview);
    if (!result.newlyRecorded) {
      setMessage("Lần ôn này chưa đến hạn hoặc đã được ghi trước đó.");
      return;
    }
    setMessage(result.nextReview
      ? `Đã ghi lần ôn. Mốc tiếp theo: +${result.nextReview.interval} ngày, vào ${result.nextReview.dueDate}.`
      : "Đã hoàn thành đủ bốn mốc ôn 1–3–7–14 ngày cho bài này.");
    void syncLocalProgress().catch(() => undefined);
  }

  if (!review?.isDue && !message) return null;

  return (
    <section className="lesson-completion" data-complete={message ? "true" : "false"} aria-labelledby="review-completion-title">
      <p className="lesson-completion__label">ÔN CÁCH QUÃNG · 1–3–7–14</p>
      <h2 id="review-completion-title">{review?.isDue ? `Bài này đang đến mốc +${review.interval} ngày` : "Đã ghi lần ôn"}</h2>
      {review?.isDue && (
        <>
          <p>Che câu trả lời cũ, nhớ lại ý hoặc mẫu câu trong 60–90 giây, rồi mở bài để đối chiếu. Không cần làm lại toàn bộ.</p>
          <button type="button" className="button lesson-completion__button" onClick={finishReview}>
            Đã ôn lại · ghi hoạt động
          </button>
        </>
      )}
      {message && <p className="lesson-completion__note" role="status" aria-atomic="true">{message}</p>}
      <p className="lesson-completion__note">Lần ôn được tính vào nhịp hoạt động nhưng không tăng số bài Done và không thay đổi trình độ.</p>
    </section>
  );
}
