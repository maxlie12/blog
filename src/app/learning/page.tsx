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
        <p>English and Chinese practice, with saved attempts and reviewed progress.</p>
        <Link href="/learning/daily" className="button">Bài hôm nay · 5 phút →</Link>
      </header>

      <div className="journey-hero journey-hero--wide">
        <h2>The ascent to C1</h2>
        <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
        <MountainJourney checkpoints={checkpoints} />
      </div>

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
