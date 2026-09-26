import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLessonById, lessons } from "@/data/lessons";
import { LessonDetailView } from "@/components/LessonDetailView";

export function generateStaticParams() {
  return lessons.map((l) => ({ lessonId: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = getLessonById(lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = getLessonById(lessonId);
  if (!lesson) notFound();

  return <LessonDetailView lesson={lesson} />;
}
