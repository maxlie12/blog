import type { Metadata } from "next";
import Link from "next/link";
import { LearningPath } from "@/components/LearningPath";
import { LocalProgressSummary } from "@/components/LocalProgressSummary";
import { getAllLessons } from "@/lib/lessonsData";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { getLearningPathData } from "@/lib/learningPathData";
import { ConversationLaunch } from "@/components/ConversationPractice";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const [lessons, path] = await Promise.all([getAllLessons({ learnerId }), getLearningPathData()]);

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Mở lên là học: tiếp tục bài dở, ôn bài đến hạn hoặc bắt đầu một bài mới trong 5–10 phút. Có thể dừng và quay lại lúc rảnh; không có bài bù bắt buộc.</p>
      </header>

      <StartLearning lessons={lessons} />
      <details><summary>Danh sách bài Daily và lộ trình học</summary>
        <LearningPath {...path} />
      </details>
      <details><summary>Luyện hội thoại theo tình huống (tùy chọn)</summary>
        <ConversationLaunch />
      </details>
      <nav className="learning-games" aria-label="Trò chơi">
        <p><strong>Góc thư giãn</strong> Không tính vào Done hay trình độ.</p>
        <Link href="/learning/village" className="button button--ghost">Làng Rêu →</Link>
        <Link href="/learning/world" className="button button--ghost">Nông trại →</Link>
      </nav>
      <LocalProgressSummary />
    </div>
  );
}
