"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hasStudioSession } from "@/lib/studioSession";
import { todayInTz } from "@/lib/streak";

export interface SubmitAttemptState {
  error?: string;
  attemptId?: string;
}

/**
 * Submitting an attempt from the public lesson page requires the same Studio session as
 * everything else that writes to this site — see docs/DECISIONS.md for why an open,
 * unauthenticated write endpoint wasn't the right call even for a "just practicing" flow.
 * Review status always starts "pending": submitting an attempt is not the same as completing
 * one — see getSkillProgress in src/lib/lessonsData.ts.
 */
export async function submitAttempt(
  _prev: SubmitAttemptState,
  formData: FormData
): Promise<SubmitAttemptState> {
  const authenticated = await hasStudioSession();
  if (!authenticated) {
    return { error: "Sign in to submit an attempt." };
  }

  const lessonId = String(formData.get("lessonId") ?? "");
  const response = String(formData.get("response") ?? "").trim();

  if (!lessonId) return { error: "Missing lesson." };
  if (response.length < 3) {
    return { error: "Write a real answer before submitting (at least a few words)." };
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { error: "This lesson no longer exists." };

  const attempt = await prisma.attempt.create({
    data: {
      lessonId,
      date: todayInTz(),
      response,
      reviewStatus: "pending",
    },
  });

  revalidatePath(`/learning/${lessonId}`);
  revalidatePath("/learning");
  revalidatePath("/");
  revalidatePath("/studio/learning");
  revalidatePath(`/studio/learning/lessons/${lessonId}`);

  return { attemptId: attempt.id };
}
