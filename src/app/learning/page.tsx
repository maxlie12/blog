import type { Metadata } from "next";
import Link from "next/link";
import { MountainJourney } from "@/components/MountainJourney";
import { PracticeLogSection } from "@/components/PracticeLogSection";
import { getAllLessons } from "@/lib/lessonsData";
import { getJourneyCheckpoints } from "@/lib/journeyData";
import { LearnerProfileSwitcher } from "@/components/LearnerProfileSwitcher";
import { LearnerAccountPanel } from "@/components/LearnerAccountPanel";
import { StartLearning } from "@/components/StartLearning";
import { getAuthenticatedLearnerId, isLearnerAuthConfigured } from "@/lib/learnerAuth";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const learnerId = await getAuthenticatedLearnerId();
  const [lessons, checkpoints] = await Promise.all([
    getAllLessons({ learnerId }),
    getJourneyCheckpoints(),
  ]);

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Không cần tự chọn giữa hàng chục bài. Hệ thống tiếp tục bản nháp, ưu tiên bài ôn đến hạn, rồi mới mở bài phù hợp tiếp theo. Mỗi phiên chỉ cần 5–10 phút.</p>
        <Link href="/learning/world" className="button button--ghost">Vào Learning Farm →</Link>{" "}
        <Link href="/learning/session" className="button button--ghost">Buổi học có hướng dẫn →</Link>{" "}
      </header>

      <LearnerProfileSwitcher />
      {isLearnerAuthConfigured() && <LearnerAccountPanel />}

      <StartLearning lessons={lessons} />

      <section className="learning-world-teaser">
        <div><p className="eyebrow">NEW · PLAY TO LEARN</p><h2>Nông trại dưới chân núi</h2><p>Trồng rau, nuôi cá, chăn gà vịt cừu bò, chế biến rồi chở hàng lên phố bán. Lưu một bài luyện 5 phút mỗi ngày để nhận thêm quà trong game.</p></div>
        <Link href="/learning/world" className="field-link">Vào nông trại ↗</Link>
      </section>

      <div className="journey-hero journey-hero--wide">
        <h2>The ascent to C1</h2>
        <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
        <MountainJourney checkpoints={checkpoints} />
      </div>

      <hr className="section-divider" />

      <PracticeLogSection />
    </div>
  );
}
