import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLessonWithAttempts } from "@/lib/lessonsData";
import { LessonForm, DeleteLessonButton, type EditableLesson } from "@/components/studio/LessonForm";
import { AttemptsPanel } from "@/components/studio/AttemptsPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lesson = await getLessonWithAttempts(id);
  return { title: lesson ? `Edit: ${lesson.title} · Studio` : "Lesson · Studio" };
}

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await getLessonWithAttempts(id);
  if (!lesson) notFound();

  const initial: EditableLesson = {
    id: lesson.id,
    skill: lesson.skill,
    title: lesson.title,
    level: lesson.level,
    instructions: lesson.instructions,
    material: lesson.material ?? "",
    exercises: lesson.exercises ?? "",
    completionCriteria: lesson.completionCriteria,
  };

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>{lesson.title}</h1>
          <p>Edit the lesson, then record or correct attempts below.</p>
        </div>
        <DeleteLessonButton id={lesson.id} />
      </header>
      <LessonForm initial={initial} />
      <hr className="section-divider" />
      <AttemptsPanel lessonId={lesson.id} attempts={lesson.attempts} />
    </div>
  );
}
