import type { Metadata } from "next";
import { LessonForm, type EditableLesson } from "@/components/studio/LessonForm";

export const metadata: Metadata = { title: "New lesson · Studio" };

const empty: EditableLesson = {
  skill: "",
  title: "",
  level: "",
  instructions: "",
  material: "",
  exercises: "",
  completionCriteria: "",
};

export default function NewLessonPage() {
  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>New lesson</h1>
          <p>Define what the learner does and what counts as done.</p>
        </div>
      </header>
      <LessonForm initial={empty} />
    </div>
  );
}
