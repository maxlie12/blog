import type { Metadata } from "next";
import Link from "next/link";
import { LearningPath } from "@/components/LearningPath";
import { LocalProgressSummary } from "@/components/LocalProgressSummary";
import { getAllLessons } from "@/lib/lessonsData";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { getLearningPathData } from "@/lib/learningPathData";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const [lessons, path] = await Promise.all([getAllLessons({ learnerId }), getLearningPathData()]);

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Không cần đăng nhập. Mở là học: tiếp tục bản nháp, ôn bài đến hạn hoặc làm bài phù hợp tiếp theo. Mỗi phiên chỉ cần 5–10 phút và tiến trình được giữ trên thiết bị này.</p>
      </header>

      <StartLearning lessons={lessons} />
      <nav className="learning-games" aria-label="Trò chơi">
        <p><strong>Góc thư giãn</strong> Không tính vào Done hay trình độ.</p>
        <Link href="/learning/village" className="button button--ghost">Làng Rêu →</Link>
        <Link href="/learning/world" className="button button--ghost">Nông trại →</Link>
      </nav>
      <LearningPath {...path} />
      <LocalProgressSummary />
    </div>
  );
}
