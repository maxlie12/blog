"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hasStudioSession } from "@/lib/studioSession";
import { todayInTz } from "@/lib/streak";
import { getDailyLesson } from "@/lib/dailyLessons";
import { getLevelLesson } from "@/lib/levelLessons";
import { getAuthenticatedLearnerId } from "@/lib/learnerAuth";
import { getHabitAccountLink } from "@/lib/habitSyncServer";
import { getLearnerProfile, isLearnerProfileId } from "@/lib/learnerProfiles";

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
  const [studioSession, learnerId] = await Promise.all([
    hasStudioSession(),
    getAuthenticatedLearnerId(),
  ]);
  if (!studioSession && !learnerId) {
    return { error: "Sign in to submit an attempt." };
  }

  const selectedProfile = formData.get("learnerProfileId");
  if (learnerId && !studioSession) {
    if (!isLearnerProfileId(selectedProfile)) return { error: "Hồ sơ người học không hợp lệ." };
    let accountLink;
    try {
      accountLink = await getHabitAccountLink(learnerId);
    } catch {
      return { error: "Chưa thể kiểm tra quyền sở hữu hồ sơ. Bài của bạn chưa được gửi." };
    }
    if (!accountLink) return { error: "Hãy liên kết hồ sơ học tập với tài khoản trước khi nộp bài." };
    if (accountLink.learnerProfileId !== selectedProfile) {
      return { error: `Tài khoản thuộc hồ sơ ${getLearnerProfile(accountLink.learnerProfileId).name}. Hãy chuyển đúng hồ sơ.` };
    }
  }

  const lessonId = String(formData.get("lessonId") ?? "");
  const response = String(formData.get("response") ?? "").trim();

  if (!lessonId) return { error: "Missing lesson." };
  if (response.length < 3) {
    return { error: "Write a real answer before submitting (at least a few words)." };
  }

  let lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    const daily = await getDailyLesson(lessonId) ?? getLevelLesson(lessonId);
    if (daily) lesson = await prisma.lesson.upsert({ where: { id: lessonId }, create: daily, update: {} });
  }
  if (!lesson) return { error: "This lesson no longer exists." };

  const attempt = await prisma.attempt.create({
    data: {
      lessonId,
      date: todayInTz(),
      response,
      learnerId: studioSession ? null : learnerId,
      isPublic: false,
      reviewStatus: "pending",
    },
  });

  revalidatePath(`/learning/${lessonId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/daily");
  revalidatePath("/");
  revalidatePath("/studio/learning");
  revalidatePath(`/studio/learning/lessons/${lessonId}`);

  return { attemptId: attempt.id };
}
