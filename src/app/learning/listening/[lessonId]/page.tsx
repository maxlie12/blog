import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabLesson } from "@/components/listening/LabLesson";
import { getDailyLabLesson, getDailyLabLessons } from "@/lib/labDaily";
import { LEVELS, labLesson, labLessons } from "@/lib/listeningLab";

export async function generateStaticParams() {
  const daily = await getDailyLabLessons();
  return [...labLessons(), ...daily].map((lesson) => ({ lessonId: lesson.id }));
}

async function findLesson(id: string) {
  return labLesson(id) ?? (await getDailyLabLesson(id));
}

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  return { title: (await findLesson(lessonId))?.title ?? "Phòng nghe" };
}

export default async function ListeningLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = await findLesson(lessonId);
  if (!lesson) notFound();
  const all = labLessons();
  const daily = "date" in lesson ? (lesson.date as string) : null;
  const following = daily ? all[0] : all[all.indexOf(lesson) + 1];
  const level = LEVELS.find((item) => item.id === lesson.level)!.name;
  return (
    <div className="learning-page ll-page">
      <Link href="/learning/listening" className="lesson-detail__back">← Phòng nghe</Link>
      <LabLesson
        lesson={lesson}
        levelName={daily ? `${level} · bài ngày ${daily.slice(8, 10)}/${daily.slice(5, 7)}` : level}
        next={following && !daily ? { id: following.id, title: following.title } : null}
      />
    </div>
  );
}
