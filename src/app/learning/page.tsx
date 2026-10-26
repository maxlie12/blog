import type { Metadata } from "next";
import { LocalProgressSummary } from "@/components/LocalProgressSummary";
import { getAllLessons } from "@/lib/lessonsData";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const lessons = await getAllLessons({ learnerId });

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Không cần đăng nhập. Mở là học: tiếp tục bản nháp, ôn bài đến hạn hoặc làm bài phù hợp tiếp theo. Mỗi phiên chỉ cần 5–10 phút và tiến trình được giữ trên thiết bị này.</p>
      </header>

      <StartLearning lessons={lessons} />
      <LocalProgressSummary />
    </div>
  );
}
