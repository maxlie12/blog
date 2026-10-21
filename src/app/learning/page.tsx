import type { Metadata } from "next";
import Link from "next/link";
import { MountainJourney } from "@/components/MountainJourney";
import { SkillCards, LessonPicker } from "@/components/LearningExplorer";
import { PracticeLogSection } from "@/components/PracticeLogSection";
import { LessonFilterProvider } from "@/lib/lessonFilter";
import { getAllLessons } from "@/lib/lessonsData";
import { getJourneyCheckpoints } from "@/lib/journeyData";
import { LearnerProfileSwitcher } from "@/components/LearnerProfileSwitcher";
import { LearnerAccountPanel } from "@/components/LearnerAccountPanel";
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
        <p>Chọn English, 中文 hoặc 日本語, rồi lọc cấp độ và kỹ năng. Mỗi bài làm trong 5–10 phút; cấp độ bài không phải kết quả đánh giá trình độ của bạn.</p>
        <Link href="/learning/world" className="button">Vào Learning Farm →</Link>{" "}
        <Link href="/learning/session" className="button button--ghost">Buổi học có hướng dẫn →</Link>{" "}
        <Link href="/learning/daily" className="button button--ghost">Kho bài theo ngày →</Link>
      </header>

      <LearnerProfileSwitcher />
      {isLearnerAuthConfigured() && <LearnerAccountPanel />}

      <section className="learning-world-teaser">
        <div><p className="eyebrow">NEW · PLAY TO LEARN</p><h2>Nông trại dưới chân núi</h2><p>Trồng rau, nuôi cá, chăn gà vịt cừu bò, chế biến rồi chở hàng lên phố bán. Lưu một bài luyện 5 phút mỗi ngày để nhận thêm quà trong game.</p></div>
        <Link href="/learning/world" className="field-link">Vào nông trại ↗</Link>
      </section>

      <div className="journey-hero journey-hero--wide">
        <h2>The ascent to C1</h2>
        <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
        <MountainJourney checkpoints={checkpoints} />
      </div>

      <section className="lesson-detail__section"><h2>Bài học theo cấp độ</h2><p>Tiếng Anh: A2 → C1 theo độ khó nhiệm vụ. Tiếng Trung: Beginner → Elementary. Tiếng Nhật: Starter → A1/N5, bắt đầu bằng Can-do giao tiếp và không coi A1 tương đương JLPT N5. Profile Luân và Phi tách riêng bản nháp, Done, streak, khóa đồng bộ và dữ liệu nông trại.</p></section>
      <LessonFilterProvider>
        <div className="learning-board">
          <SkillCards lessons={lessons} />
          <div className="learning-board__picker">
            <LessonPicker lessons={lessons} />
          </div>
        </div>
      </LessonFilterProvider>

      <hr className="section-divider" />

      <PracticeLogSection />
    </div>
  );
}
