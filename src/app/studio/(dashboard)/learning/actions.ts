"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudioSession } from "@/lib/studioSession";
import { isValidSkill } from "@/lib/lessonsData";

export interface LessonFormState {
  fieldErrors?: string[];
}

function readLessonInput(formData: FormData) {
  return {
    skill: String(formData.get("skill") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    level: String(formData.get("level") ?? "").trim(),
    instructions: String(formData.get("instructions") ?? "").trim(),
    material: String(formData.get("material") ?? "").trim() || null,
    exercises: String(formData.get("exercises") ?? "").trim() || null,
    completionCriteria: String(formData.get("completionCriteria") ?? "").trim(),
  };
}

function validateLesson(input: ReturnType<typeof readLessonInput>): string[] {
  const errors: string[] = [];
  if (!isValidSkill(input.skill)) errors.push("Choose a valid skill.");
  if (!input.title) errors.push("Title is required.");
  if (!input.level) errors.push("Target level is required.");
  if (!input.instructions) errors.push("Instructions are required.");
  if (!input.completionCriteria) errors.push("Completion criteria is required.");
  return errors;
}

export async function saveLesson(formData: FormData): Promise<LessonFormState> {
  await requireStudioSession();
  const id = String(formData.get("id") ?? "") || undefined;
  const input = readLessonInput(formData);
  const fieldErrors = validateLesson(input);
  if (fieldErrors.length > 0) return { fieldErrors };

  const lesson = id
    ? await prisma.lesson.update({ where: { id }, data: input })
    : await prisma.lesson.create({ data: input });

  revalidatePath("/learning");
  revalidatePath("/studio/learning");
  revalidatePath(`/studio/learning/lessons/${lesson.id}`);

  if (!id) redirect(`/studio/learning/lessons/${lesson.id}`);
  return {};
}

export async function deleteLesson(id: string): Promise<void> {
  await requireStudioSession();
  await prisma.lesson.delete({ where: { id } });
  revalidatePath("/learning");
  revalidatePath("/studio/learning");
  redirect("/studio/learning");
}

export interface AttemptFormState {
  fieldErrors?: string[];
}

export async function addAttempt(formData: FormData): Promise<AttemptFormState> {
  await requireStudioSession();
  const lessonId = String(formData.get("lessonId") ?? "");
  const date = String(formData.get("date") ?? "");
  const response = String(formData.get("response") ?? "").trim() || null;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  const reviewStatus = String(formData.get("reviewStatus") ?? "pending");

  const fieldErrors: string[] = [];
  if (!lessonId) fieldErrors.push("Missing lesson.");
  if (!date) fieldErrors.push("Date is required.");
  if (!["pending", "reviewed", "needs-revision"].includes(reviewStatus)) {
    fieldErrors.push("Invalid review status.");
  }
  if (fieldErrors.length > 0) return { fieldErrors };

  await prisma.attempt.create({
    data: { lessonId, date, response, feedback, reviewStatus },
  });

  revalidatePath("/learning");
  revalidatePath(`/learning/${lessonId}`);
  revalidatePath(`/studio/learning/lessons/${lessonId}`);
  revalidatePath("/studio");
  return {};
}

export async function updateAttempt(formData: FormData): Promise<AttemptFormState> {
  await requireStudioSession();
  const id = String(formData.get("id") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const date = String(formData.get("date") ?? "");
  const response = String(formData.get("response") ?? "").trim() || null;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  const reviewStatus = String(formData.get("reviewStatus") ?? "pending");

  await prisma.attempt.update({
    where: { id },
    data: { date, response, feedback, reviewStatus },
  });

  revalidatePath("/learning");
  revalidatePath(`/learning/${lessonId}`);
  revalidatePath(`/studio/learning/lessons/${lessonId}`);
  revalidatePath("/studio");
  return {};
}

export async function deleteAttempt(id: string, lessonId: string): Promise<void> {
  await requireStudioSession();
  await prisma.attempt.delete({ where: { id } });
  revalidatePath("/learning");
  revalidatePath(`/learning/${lessonId}`);
  revalidatePath(`/studio/learning/lessons/${lessonId}`);
}
