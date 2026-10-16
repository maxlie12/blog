import type { Metadata } from "next";
import Link from "next/link";
import { MountainJourney } from "@/components/MountainJourney";
import { SkillCards, LessonPicker } from "@/components/LearningExplorer";
import { PracticeLogSection } from "@/components/PracticeLogSection";
import { LessonFilterProvider } from "@/lib/lessonFilter";
import { getAllLessons } from "@/lib/lessonsData";
import { getJourneyCheckpoints } from "@/lib/journeyData";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const [lessons, checkpoints] = await Promise.all([
    getAllLessons(),
    getJourneyCheckpoints(),
  ]);

  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>Chọn ngôn ngữ, cấp độ và kỹ năng. Mỗi bài làm trong 5–10 phút; cấp độ bài không phải kết quả đánh giá trình độ của bạn.</p>
        <Link href="/learning/world" className="button">Vào Learning Farm 3D →</Link>{" "}
        <Link href="/learning/session" className="button button--ghost">Buổi học có hướng dẫn →</Link>{" "}
        <Link href="/learning/daily" className="button button--ghost">Kho bài theo ngày →</Link>
      </header>

      <section className="learning-world-teaser">
        <div><p className="eyebrow">NEW · PLAY TO LEARN</p><h2>Nông trại dưới chân núi</h2><p>Chọn khu vực, nhận nhiệm vụ tiếng Anh ngay trong gameplay và dùng bài làm thật để phát triển thế giới. Tiếng Trung là tuyến làng nhỏ bên cạnh.</p></div>
        <Link href="/learning/world" className="field-link">Khám phá thế giới học tập ↗</Link>
      </section>

      <div className="journey-hero journey-hero--wide">
        <h2>The ascent to C1</h2>
        <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
        <MountainJourney checkpoints={checkpoints} />
      </div>

      <section className="lesson-detail__section"><h2>Bài học theo cấp độ</h2><p>Tiếng Anh: A2 để ôn nền, B1 kể chuyện, B1+ luyện hiện tại, B2 lập luận và C1 sắc thái. Tiếng Trung: Beginner → Elementary, là nhóm sơ cấp nội bộ. Bắt đầu B1+ nếu chưa có đánh giá khác; có thể xem thử mức cao hơn mà không tự ghi nhận lên trình độ.</p></section>
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
