import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabLesson } from "@/components/listening/LabLesson";
import { LEVELS, labLesson, labLessons } from "@/lib/listeningLab";

export function generateStaticParams() {
  return labLessons().map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  return { title: labLesson(lessonId)?.title ?? "Phòng nghe" };
}

export default async function ListeningLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = labLesson(lessonId);
  if (!lesson) notFound();
  const all = labLessons();
  const following = all[all.indexOf(lesson) + 1];
  return (
    <div className="learning-page ll-page">
      <Link href="/learning/listening" className="lesson-detail__back">← Phòng nghe</Link>
      <LabLesson
        lesson={lesson}
        levelName={LEVELS.find((level) => level.id === lesson.level)!.name}
        next={following ? { id: following.id, title: following.title } : null}
      />
    </div>
  );
}
