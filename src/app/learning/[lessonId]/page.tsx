import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLessonWithAttempts } from "@/lib/lessonsData";
import { hasStudioSession } from "@/lib/studioSession";
import { LessonDetailView } from "@/components/LessonDetailView";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getLessonWithAttempts(lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const [studioSession, learnerId] = await Promise.all([
    hasStudioSession(),
    getAuthenticatedLearnerId(),
  ]);
  const lesson = await getLessonWithAttempts(lessonId, studioSession ? { includeAll: true } : { learnerId });
  if (!lesson) notFound();

  return <LessonDetailView lesson={lesson} attempts={lesson.attempts} canSubmit={studioSession || Boolean(learnerId)} />;
}
