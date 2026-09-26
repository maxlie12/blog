import type { Metadata } from "next";
import { MountainJourney } from "@/components/MountainJourney";
import { SkillCards, LessonPicker } from "@/components/LearningExplorer";
import { DailyGoalWidget } from "@/components/DailyGoalWidget";
import { PracticeLogSection } from "@/components/PracticeLogSection";
import { LessonFilterProvider } from "@/lib/lessonFilter";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default function LearningPage() {
  return (
    <div className="learning-page">
      <header className="section-page__header">
        <h1>Learning</h1>
        <p>English practice exercises, and — further down — real, tracked practice data.</p>
      </header>

      <div className="journey-hero journey-hero--wide">
        <h2>The ascent to C1</h2>
        <p>A long-term journey to clearer expression, deeper understanding, and a more open world.</p>
        <MountainJourney />
      </div>

      <LessonFilterProvider>
        <div className="learning-board">
          <SkillCards />
          <div className="learning-board__picker">
            <LessonPicker />
            <DailyGoalWidget />
          </div>
        </div>
      </LessonFilterProvider>

      <hr className="section-divider" />

      <PracticeLogSection />
    </div>
  );
}
