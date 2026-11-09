"use client";

import { useEffect, useState } from "react";
import { dateInLearningTimezone, getLocalScheduledReview, recordLocalRecall, syncLocalProgress } from "@/lib/localLearningProgress";
import type { LessonTakeaway } from "@/lib/dailyLessons";
import type { SkillId } from "@/lib/lessonTypes";
import { RECALL_RATINGS, type RecallRating, type ScheduledReview } from "@/lib/reviewSchedule";

const labels: Record<RecallRating, string> = {
  again: "Chưa nhớ", hard: "Nhớ nhưng còn khó", remembered: "Nhớ và dùng lại được",
};
const improvements: Record<RecallRating, string> = {
  again: "Cần củng cố: chọn một ý hoặc cụm, xem lại rồi che chữ và thử nói lại một câu.",
  hard: "Cần luyện: giữ một khung câu, đổi một chi tiết và thử nói lại không nhìn mẫu.",
  remembered: "Lần tới: thử dùng cùng cụm trong một tình huống khác, không học thuộc câu cũ.",
};

export function ReviewCompletion({ lessonId, language, skill, takeaway }: {
  lessonId: string; language: string; skill: SkillId; takeaway?: LessonTakeaway;
}) {
  const [review, setReview] = useState<ScheduledReview | null>(null);
  const [compared, setCompared] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setReview(getLocalScheduledReview(lessonId));
    refresh();
    window.addEventListener("learning-progress-changed", refresh);
    return () => window.removeEventListener("learning-progress-changed", refresh);
  }, [lessonId]);

  function finishReview(rating: RecallRating) {
    try {
      const result = recordLocalRecall({ lessonId, language, skill, minutes: 3 }, rating);
      setReview(result.nextReview);
      setCompared(false);
      setMessage(result.newlyRecorded ? "Đã lưu kết quả tự kiểm tra trên thiết bị." : "Đã ghi hôm nay hoặc chưa đến hạn ôn tiếp.");
      if (result.newlyRecorded) void syncLocalProgress().catch(() => {
        setMessage("Đã lưu trên thiết bị; chưa đồng bộ được với máy chủ.");
      });
    } catch {
      setMessage("Chưa lưu được. Giữ trang này và thử lại; kết quả chưa được ghi nhận.");
    }
  }

  if (!review) return null;
  const canCheck = !review.lastRecall || (review.isDue && review.lastRecall.date !== dateInLearningTimezone());

  return <section id="lesson-recall" className="lesson-completion" aria-labelledby="review-completion-title">
    <p className="lesson-completion__label">TỰ KIỂM TRA · ÔN THEO KHẢ NĂNG NHỚ</p>
    <h2 id="review-completion-title">{review.isDue ? "Đến lượt nhớ lại bài này" : "Giữ lại một điều sau phiên học"}</h2>
    <p>Ôn tiếp: <time dateTime={review.dueDate}>{review.dueDate}</time> · khoảng cách {review.interval} ngày.</p>
    {review.lastRecall && <>
      <p>Lần tự kiểm tra {review.lastRecall.date}: <strong>{labels[review.lastRecall.rating]}</strong>.</p>
      <p>{improvements[review.lastRecall.rating]}</p>
    </>}
    {canCheck && <>
      <p>Che bài và câu trả lời cũ. Thử nhớ lại trong 60–90 giây: {takeaway?.reusePrompt ?? "Nói một ý chính hoặc mẫu câu của bài bằng lời của bạn, rồi đổi một chi tiết."}</p>
      <button type="button" className="button button--ghost" aria-expanded={compared} onClick={() => setCompared(!compared)}>
        {compared ? "Ẩn phần đối chiếu" : "Đã tự nhớ lại · mở phần đối chiếu"}
      </button>
      {compared && <>
        {takeaway ? <p><strong>{takeaway.phrase}</strong><br />{takeaway.pattern}</p> : <p>Đối chiếu với nguồn và đầu ra đã lưu bên dưới. Chọn theo điều bạn thực sự tự nhớ được trước khi xem.</p>}
        <p>Sau khi đối chiếu, bạn tự đánh giá thế nào?</p>
        <div className="lesson-completion__actions">
          {RECALL_RATINGS.map(rating => <button key={rating} type="button" className="button button--ghost lesson-completion__button" onClick={() => finishReview(rating)}>{labels[rating]}</button>)}
        </div>
      </>}
    </>}
    <p className="lesson-completion__note" role="status" aria-atomic="true">{message}</p>
    <p className="lesson-completion__note">Tự báo để chọn lần ôn tiếp, không phải điểm năng lực. Chưa nhớ: ôn sau 1 ngày; còn khó: giữ khoảng cách; nhớ được khi ôn đến hạn: tăng 1 → 3 → 7 → 14 ngày. Lần kiểm tra đầu ngay sau học vẫn hẹn ngày mai.</p>
  </section>;
}
