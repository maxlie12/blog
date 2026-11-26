import type { Metadata } from "next";
import Link from "next/link";
import { LearningPath } from "@/components/LearningPath";
import { LocalProgressSummary } from "@/components/LocalProgressSummary";
import { getAllLessons } from "@/lib/lessonsData";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { getLearningPathData } from "@/lib/learningPathData";
import { ConversationLaunch } from "@/components/ConversationPractice";
import { LabEntry } from "@/components/listening/LabIndex";
import { StudyBrief } from "@/components/StudyBrief";
import { dailySummaries, getDailyLabLessons } from "@/lib/labDaily";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const [lessons, path, dailyLab] = await Promise.all([getAllLessons({ learnerId }), getLearningPathData(), getDailyLabLessons()]);
  const daily = dailySummaries(dailyLab);

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Tiếng Anh học ở Phòng nghe: mỗi ngày một bài mới, cùng 6 bước từ vựng → nghe → đọc → viết → nói → kết quả, có chấm điểm. Tiếng Trung ở thẻ bên dưới. Có thể dừng và quay lại lúc rảnh; không có bài bù bắt buộc.</p>
      </header>

      <LabEntry daily={daily} />
      <StudyBrief daily={daily} />
      <StartLearning lessons={lessons.filter((lesson) => lesson.language === "zh")} />
      <LocalProgressSummary />
      <details><summary>Bài Daily dạng cũ (tiếng Anh, tiếng Trung) và lộ trình học</summary>
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
    </div>
  );
}
